import { createHash } from "node:crypto";
import type { TransactionSql } from "postgres";
import { z } from "zod";
import { apiErrorResponse, privateJson, RequestValidationError } from "@/lib/api";
import type { AuthenticatedIdentity } from "@/lib/authorization";
import { AuthorizationError } from "@/lib/authorization";
import { getDb } from "@/lib/db";
import { readIdempotencyResponse } from "@/lib/idempotency-response";
import {
  deleteStoredEvidence,
  EvidenceStorageNotConfiguredError,
  EvidenceValidationError,
  storeEvidence,
  type StoredEvidence,
} from "@/lib/evidence-storage";
import {
  getReviewFlags,
  LocationValidationError,
  locationFixSchema,
  validateFreshLocation,
} from "@/lib/location";
import { MapboxDirectionsProvider, type RouteEstimate, type RouteRequest } from "@/lib/routing";
import { canSubmitMilestone } from "@/lib/travel-state";

export class TravelConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TravelConflictError";
  }
}

export class TravelNotFoundError extends Error {
  constructor() {
    super("Travel session or approved itinerary stop was not found.");
    this.name = "TravelNotFoundError";
  }
}

export function assertMilestoneAllowed(
  status: string,
  kind: "ARRIVAL" | "CHECKOUT",
  arrivalExists: boolean,
): void {
  if (!canSubmitMilestone(status, kind, arrivalExists)) {
    throw new TravelConflictError(
      kind === "ARRIVAL"
        ? "Arrival can only be submitted for a trip currently in transit."
        : "Submit arrival for this itinerary stop before checking out.",
    );
  }
}

const startSchema = z.object({
  itineraryStopId: z.string().uuid(),
  idempotencyKey: z.string().uuid(),
  fix: locationFixSchema,
});

const locationSchema = z.object({
  idempotencyKey: z.string().uuid(),
  fix: locationFixSchema,
});

const checkInSchema = z.object({
  idempotencyKey: z.string().uuid(),
  fix: locationFixSchema,
});

export type StartTravelInput = z.infer<typeof startSchema>;

export function parseStartTravel(value: unknown): StartTravelInput {
  const parsed = startSchema.safeParse(value);
  if (!parsed.success) throw new RequestValidationError("Start Travel details are invalid.");
  return parsed.data;
}

export function parseLocationUpdate(value: unknown) {
  const parsed = locationSchema.safeParse(value);
  if (!parsed.success) throw new RequestValidationError("Location update details are invalid.");
  return parsed.data;
}

export function parseCheckInFields(value: unknown) {
  const parsed = checkInSchema.safeParse(value);
  if (!parsed.success) throw new RequestValidationError("Milestone details are invalid.");
  return parsed.data;
}

function requestHash(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function assertParticipant(identity: AuthenticatedIdentity): void {
  if (!identity.assignments.some((assignment) => assignment.role === "PARTICIPANT")) {
    throw new AuthorizationError("Only assigned participants can submit travel milestones.", 403);
  }
}

async function estimateRoute(request: RouteRequest): Promise<RouteEstimate | null> {
  try {
    return await new MapboxDirectionsProvider().estimate(request);
  } catch (error) {
    console.error("Route ETA is unavailable; travel can continue without an estimate.", error);
    return null;
  }
}

async function getEligibleStop(
  participantId: string,
  itineraryStopId: string,
): Promise<{
  activityId: string;
  participationId: string;
  latitude: number;
  longitude: number;
  travelMode: RouteRequest["travelMode"];
}> {
  const db = getDb();
  const [stop] = await db<
    {
      activity_id: string;
      participation_id: string;
      latitude: number;
      longitude: number;
      travel_mode: RouteRequest["travelMode"];
    }[]
  >`
    SELECT
      s.activity_id,
      p.id AS participation_id,
      ST_Y(s.location::geometry) AS latitude,
      ST_X(s.location::geometry) AS longitude,
      s.travel_mode
    FROM itinerary_stop s
    JOIN activity a ON a.id = s.activity_id AND a.approval_status = 'APPROVED'
    JOIN participation p ON p.activity_id = a.id
      AND p.user_id = ${participantId}::uuid
      AND p.assignment_status = 'ASSIGNED'
    WHERE s.id = ${itineraryStopId}::uuid
      AND s.is_active
    LIMIT 1
  `;
  if (!stop) throw new TravelNotFoundError();

  return {
    activityId: stop.activity_id,
    participationId: stop.participation_id,
    latitude: stop.latitude,
    longitude: stop.longitude,
    travelMode: stop.travel_mode,
  };
}

function storedEstimate(estimate: RouteEstimate | null) {
  return {
    etaAt: estimate?.etaAt.toISOString() ?? null,
    etaDistanceM: estimate?.distanceMeters ?? null,
    etaProvider: estimate?.provider ?? null,
    etaStatus: estimate ? "AVAILABLE" : "UNAVAILABLE",
  } as const;
}

export async function startTravel(identity: AuthenticatedIdentity, rawInput: unknown) {
  assertParticipant(identity);
  const input = parseStartTravel(rawInput);
  const hash = requestHash(input);
  const db = getDb();
  const [cachedStart] = await db<
    { operation: string; request_hash: string; response: unknown }[]
  >`
    SELECT operation, request_hash, response
    FROM idempotency_record
    WHERE participant_id = ${identity.id}::uuid
      AND idempotency_key = ${input.idempotencyKey}::uuid
  `;
  if (cachedStart) {
    if (cachedStart.operation !== "START_TRAVEL" || cachedStart.request_hash !== hash) {
      throw new TravelConflictError("This idempotency key was already used for a different request.");
    }
    return readIdempotencyResponse(cachedStart.response);
  }

  const receivedAt = new Date();
  validateFreshLocation(input.fix, receivedAt.getTime());
  const stop = await getEligibleStop(identity.id, input.itineraryStopId);

  const [activeSession] = await db<
    {
      id: string;
      itinerary_stop_id: string;
      status: string;
      started_at: Date;
      eta_at: Date | null;
      eta_distance_m: number | null;
      eta_provider: string | null;
      eta_status: string;
    }[]
  >`
    SELECT id, itinerary_stop_id, status::text, started_at, eta_at,
      eta_distance_m, eta_provider, eta_status
    FROM travel_session
    WHERE participation_id = ${stop.participationId}::uuid
      AND status IN ('IN_TRANSIT', 'ARRIVAL_SUBMITTED', 'CHECKED_IN')
    ORDER BY started_at DESC
    LIMIT 1
  `;
  if (activeSession) {
    if (activeSession.status !== "IN_TRANSIT" || activeSession.itinerary_stop_id !== input.itineraryStopId) {
      throw new TravelConflictError("Finish the currently open travel session before starting another.");
    }
    const response = {
      travelSessionId: activeSession.id,
      status: activeSession.status,
      startedAt: activeSession.started_at.toISOString(),
      etaAt: activeSession.eta_at?.toISOString() ?? null,
      etaDistanceM: activeSession.eta_distance_m,
      etaProvider: activeSession.eta_provider,
      etaStatus: activeSession.eta_status,
    };
    return db.begin(async (transaction) => {
      await transaction`
        SELECT pg_advisory_xact_lock(hashtextextended(${`${identity.id}:${input.idempotencyKey}`}, 0))
      `;
      const [existing] = await transaction<{ request_hash: string; operation: string; response: unknown }[]>`
        SELECT request_hash, operation, response
        FROM idempotency_record
        WHERE participant_id = ${identity.id}::uuid
          AND idempotency_key = ${input.idempotencyKey}::uuid
      `;
      if (existing) {
        if (existing.operation !== "START_TRAVEL" || existing.request_hash !== hash) {
          throw new TravelConflictError("This idempotency key was already used for a different request.");
        }
        return readIdempotencyResponse(existing.response);
      }
      await transaction`
        INSERT INTO idempotency_record (
          participant_id, idempotency_key, operation, request_hash, resource_id, response
        )
        VALUES (
          ${identity.id}::uuid,
          ${input.idempotencyKey}::uuid,
          'START_TRAVEL',
          ${hash},
          ${activeSession.id}::uuid,
          ${JSON.stringify(response)}::text::jsonb
        )
      `;
      return response;
    });
  }

  const estimate = await estimateRoute({
    origin: { latitude: input.fix.latitude, longitude: input.fix.longitude },
    destination: { latitude: stop.latitude, longitude: stop.longitude },
    travelMode: stop.travelMode,
  });
  validateFreshLocation(input.fix, new Date().getTime());
  const eta = storedEstimate(estimate);

  return db.begin(async (transaction) => {
    await transaction`
      SELECT pg_advisory_xact_lock(hashtextextended(${`${identity.id}:${input.idempotencyKey}`}, 0))
    `;
    const [existingRequest] = await transaction<
      { operation: string; request_hash: string; response: unknown }[]
    >`
      SELECT operation, request_hash, response
      FROM idempotency_record
      WHERE participant_id = ${identity.id}::uuid
        AND idempotency_key = ${input.idempotencyKey}::uuid
    `;
    if (existingRequest) {
      if (existingRequest.operation !== "START_TRAVEL" || existingRequest.request_hash !== hash) {
        throw new TravelConflictError("This idempotency key was already used for a different request.");
      }
      return readIdempotencyResponse(existingRequest.response);
    }

    const [currentStop] = await transaction<
      { activity_id: string; itinerary_day: number; stop_sequence: number }[]
    >`
      SELECT s.activity_id, s.itinerary_day, s.stop_sequence
      FROM itinerary_stop s
      JOIN activity a ON a.id = s.activity_id AND a.approval_status = 'APPROVED'
      JOIN participation p ON p.activity_id = a.id
        AND p.id = ${stop.participationId}::uuid
        AND p.user_id = ${identity.id}::uuid
        AND p.assignment_status = 'ASSIGNED'
      WHERE s.id = ${input.itineraryStopId}::uuid
        AND s.is_active
      FOR SHARE
    `;
    if (!currentStop) throw new TravelNotFoundError();

    const [hasIncompleteEarlierStop] = await transaction<{ incomplete: boolean }[]>`
      SELECT EXISTS (
        SELECT 1
        FROM itinerary_stop previous_stop
        WHERE previous_stop.activity_id = ${currentStop.activity_id}::uuid
          AND previous_stop.is_active
          AND (previous_stop.itinerary_day, previous_stop.stop_sequence)
              < (${currentStop.itinerary_day}, ${currentStop.stop_sequence})
          AND NOT EXISTS (
            SELECT 1
            FROM travel_session previous_session
            JOIN participation previous_participation
              ON previous_participation.id = previous_session.participation_id
            JOIN check_in previous_checkout
              ON previous_checkout.travel_session_id = previous_session.id
              AND previous_checkout.kind = 'CHECKOUT'
            WHERE previous_participation.id = ${stop.participationId}::uuid
              AND previous_session.itinerary_stop_id = previous_stop.id
          )
      ) AS incomplete
    `;
    if (hasIncompleteEarlierStop.incomplete) {
      throw new TravelConflictError("Complete the earlier approved itinerary stop before starting this trip.");
    }

    await transaction`
      SELECT pg_advisory_xact_lock(hashtextextended(${stop.participationId}, 1))
    `;
    const [openSession] = await transaction<{ id: string; status: string }[]>`
      SELECT id, status::text
      FROM travel_session
      WHERE participation_id = ${stop.participationId}::uuid
        AND status IN ('IN_TRANSIT', 'ARRIVAL_SUBMITTED', 'CHECKED_IN')
      FOR UPDATE
    `;
    if (openSession) {
      if (openSession.status === "IN_TRANSIT" && input.itineraryStopId) {
        const [sameStop] = await transaction<{
          id: string;
          started_at: Date;
          eta_at: Date | null;
          eta_distance_m: number | null;
          eta_provider: string | null;
          eta_status: string;
        }[]>`
          SELECT id, started_at, eta_at, eta_distance_m, eta_provider, eta_status
          FROM travel_session
          WHERE id = ${openSession.id}::uuid AND itinerary_stop_id = ${input.itineraryStopId}::uuid
        `;
        if (sameStop) {
          const response = {
            travelSessionId: sameStop.id,
            status: openSession.status,
            startedAt: sameStop.started_at.toISOString(),
            etaAt: sameStop.eta_at?.toISOString() ?? null,
            etaDistanceM: sameStop.eta_distance_m,
            etaProvider: sameStop.eta_provider,
            etaStatus: sameStop.eta_status,
          };
          await transaction`
            INSERT INTO idempotency_record (
              participant_id, idempotency_key, operation, request_hash, resource_id, response
            )
            VALUES (
              ${identity.id}::uuid,
              ${input.idempotencyKey}::uuid,
              'START_TRAVEL',
              ${hash},
              ${sameStop.id}::uuid,
              ${JSON.stringify(response)}::text::jsonb
            )
          `;
          return response;
        }
      }
      throw new TravelConflictError("Finish the currently open travel session before starting another.");
    }

    const [alreadyCheckedOut] = await transaction<{ id: string }[]>`
      SELECT check_out.id
      FROM travel_session existing
      JOIN check_in check_out
        ON check_out.travel_session_id = existing.id AND check_out.kind = 'CHECKOUT'
      WHERE existing.participation_id = ${stop.participationId}::uuid
        AND existing.itinerary_stop_id = ${input.itineraryStopId}::uuid
      LIMIT 1
    `;
    if (alreadyCheckedOut) {
      throw new TravelConflictError("This stop has already been checked out. Select the next approved stop.");
    }

    const [session] = await transaction<{ id: string; started_at: Date }[]>`
      INSERT INTO travel_session (
        participation_id, participant_id, itinerary_stop_id, start_idempotency_key,
        origin_location, origin_accuracy_m, origin_gps_acquired_at,
        eta_at, eta_distance_m, eta_provider, eta_status,
        last_location, last_accuracy_m, last_gps_acquired_at,
        last_location_received_at, started_at, status
      )
      VALUES (
        ${stop.participationId}::uuid,
        ${identity.id}::uuid,
        ${input.itineraryStopId}::uuid,
        ${input.idempotencyKey}::uuid,
        ST_SetSRID(ST_MakePoint(${input.fix.longitude}, ${input.fix.latitude}), 4326)::geography,
        ${input.fix.accuracyM},
        ${input.fix.gpsAcquiredAt}::timestamptz,
        ${eta.etaAt}::timestamptz,
        ${eta.etaDistanceM},
        ${eta.etaProvider},
        ${eta.etaStatus},
        ST_SetSRID(ST_MakePoint(${input.fix.longitude}, ${input.fix.latitude}), 4326)::geography,
        ${input.fix.accuracyM},
        ${input.fix.gpsAcquiredAt}::timestamptz,
        now(),
        now(),
        'IN_TRANSIT'
      )
      RETURNING id, started_at
    `;
    const response = {
      travelSessionId: session.id,
      status: "IN_TRANSIT",
      startedAt: session.started_at.toISOString(),
      ...eta,
    };
    await transaction`
      INSERT INTO idempotency_record (
        participant_id, idempotency_key, operation, request_hash, resource_id, response
      )
      VALUES (
        ${identity.id}::uuid,
        ${input.idempotencyKey}::uuid,
        'START_TRAVEL',
        ${hash},
        ${session.id}::uuid,
        ${JSON.stringify(response)}::text::jsonb
      )
    `;
    await transaction`
      INSERT INTO audit_log (actor_id, action, resource_type, resource_id, details)
      VALUES (
        ${identity.id}::uuid,
        'TRAVEL_STARTED',
        'travel_session',
        ${session.id},
        ${JSON.stringify({ itineraryStopId: input.itineraryStopId, etaStatus: eta.etaStatus })}::text::jsonb
      )
    `;
    return response;
  });
}

export async function updateTravelLocation(
  identity: AuthenticatedIdentity,
  travelSessionId: string,
  rawInput: unknown,
) {
  assertParticipant(identity);
  const sessionId = z.string().uuid().safeParse(travelSessionId);
  if (!sessionId.success) throw new RequestValidationError("Travel session ID must be a UUID.");
  const input = parseLocationUpdate(rawInput);
  const hash = requestHash({ sessionId: travelSessionId, ...input });
  const db = getDb();
  const [cachedUpdate] = await db<
    { operation: string; request_hash: string; response: unknown }[]
  >`
    SELECT operation, request_hash, response
    FROM idempotency_record
    WHERE participant_id = ${identity.id}::uuid
      AND idempotency_key = ${input.idempotencyKey}::uuid
  `;
  if (cachedUpdate) {
    if (cachedUpdate.operation !== "LOCATION_UPDATE" || cachedUpdate.request_hash !== hash) {
      throw new TravelConflictError("This idempotency key was already used for a different request.");
    }
    return readIdempotencyResponse(cachedUpdate.response);
  }
  validateFreshLocation(input.fix, new Date().getTime());

  const [context] = await getDb()<
    {
      activity_id: string;
      latitude: number;
      longitude: number;
      travel_mode: RouteRequest["travelMode"];
    }[]
  >`
    SELECT s.activity_id,
      ST_Y(s.location::geometry) AS latitude,
      ST_X(s.location::geometry) AS longitude,
      s.travel_mode
    FROM travel_session ts
    JOIN itinerary_stop s ON s.id = ts.itinerary_stop_id
    JOIN activity a ON a.id = s.activity_id
    JOIN participation p ON p.id = ts.participation_id
      AND p.user_id = ${identity.id}::uuid
      AND p.assignment_status = 'ASSIGNED'
    WHERE ts.id = ${travelSessionId}::uuid
      AND s.is_active
      AND ts.status = 'IN_TRANSIT'
    LIMIT 1
  `;
  if (!context) throw new TravelNotFoundError();

  const estimate = await estimateRoute({
    origin: { latitude: input.fix.latitude, longitude: input.fix.longitude },
    destination: { latitude: context.latitude, longitude: context.longitude },
    travelMode: context.travel_mode,
  });
  validateFreshLocation(input.fix, new Date().getTime());
  const eta = storedEstimate(estimate);
  return db.begin(async (transaction) => {
    await transaction`
      SELECT pg_advisory_xact_lock(hashtextextended(${`${identity.id}:${input.idempotencyKey}`}, 0))
    `;
    const [existing] = await transaction<
      { operation: string; request_hash: string; response: unknown }[]
    >`
      SELECT operation, request_hash, response
      FROM idempotency_record
      WHERE participant_id = ${identity.id}::uuid
        AND idempotency_key = ${input.idempotencyKey}::uuid
    `;
    if (existing) {
      if (existing.operation !== "LOCATION_UPDATE" || existing.request_hash !== hash) {
        throw new TravelConflictError("This idempotency key was already used for a different request.");
      }
      return readIdempotencyResponse(existing.response);
    }

    const [session] = await transaction<{ id: string }[]>`
      SELECT id FROM travel_session
      WHERE id = ${travelSessionId}::uuid
        AND participant_id = ${identity.id}::uuid
        AND status = 'IN_TRANSIT'
      FOR UPDATE
    `;
    if (!session) throw new TravelConflictError("Location updates are only available during travel.");

    const [update] = await transaction<{ id: string; server_received_at: Date }[]>`
      INSERT INTO travel_location_update (
        travel_session_id, idempotency_key, location, accuracy_m, gps_acquired_at,
        eta_at, eta_distance_m, eta_provider, eta_status
      )
      VALUES (
        ${travelSessionId}::uuid,
        ${input.idempotencyKey}::uuid,
        ST_SetSRID(ST_MakePoint(${input.fix.longitude}, ${input.fix.latitude}), 4326)::geography,
        ${input.fix.accuracyM},
        ${input.fix.gpsAcquiredAt}::timestamptz,
        ${eta.etaAt}::timestamptz,
        ${eta.etaDistanceM},
        ${eta.etaProvider},
        ${eta.etaStatus}
      )
      RETURNING id, server_received_at
    `;
    await transaction`
      UPDATE travel_session
      SET last_location = ST_SetSRID(ST_MakePoint(${input.fix.longitude}, ${input.fix.latitude}), 4326)::geography,
          last_accuracy_m = ${input.fix.accuracyM},
          last_gps_acquired_at = ${input.fix.gpsAcquiredAt}::timestamptz,
          last_location_received_at = ${update.server_received_at},
          eta_at = ${eta.etaAt}::timestamptz,
          eta_distance_m = ${eta.etaDistanceM},
          eta_provider = ${eta.etaProvider},
          eta_status = ${eta.etaStatus}
      WHERE id = ${travelSessionId}::uuid
    `;
    const response = {
      locationUpdateId: update.id,
      serverReceivedAt: update.server_received_at.toISOString(),
      ...eta,
    };
    await transaction`
      INSERT INTO idempotency_record (
        participant_id, idempotency_key, operation, request_hash, resource_id, response
      )
      VALUES (
        ${identity.id}::uuid,
        ${input.idempotencyKey}::uuid,
        'LOCATION_UPDATE',
        ${hash},
        ${update.id}::uuid,
        ${JSON.stringify(response)}::text::jsonb
      )
    `;
    await transaction`
      INSERT INTO audit_log (actor_id, action, resource_type, resource_id, details)
      VALUES (
        ${identity.id}::uuid,
        'TRAVEL_LOCATION_UPDATED',
        'travel_session',
        ${travelSessionId},
        ${JSON.stringify({ accuracyM: input.fix.accuracyM, etaStatus: eta.etaStatus })}::text::jsonb
      )
    `;
    return response;
  });
}

export async function submitCheckIn(
  identity: AuthenticatedIdentity,
  travelSessionId: string,
  kind: "ARRIVAL" | "CHECKOUT",
  rawInput: unknown,
  photo: { bytes: Buffer; contentType: string } | null,
) {
  assertParticipant(identity);
  const parsedSession = z.string().uuid().safeParse(travelSessionId);
  if (!parsedSession.success) throw new RequestValidationError("Travel session ID must be a UUID.");
  const input = parseCheckInFields(rawInput);

  const fixHash = createHash("sha256")
    .update(
      JSON.stringify({
        travelSessionId,
        kind,
        idempotencyKey: input.idempotencyKey,
        fix: input.fix,
      }),
    )
    .digest("hex");
  const photoHash = photo
    ? createHash("sha256").update(photo.bytes).digest("hex")
    : "NO_EVIDENCE";
  const hash = createHash("sha256").update(`${fixHash}:${photoHash}`).digest("hex");
  const db = getDb();
  const storedState: { evidence: StoredEvidence | null } = { evidence: null };

  try {
    const response = await db.begin(async (transaction) => {
      await transaction`
        SELECT pg_advisory_xact_lock(hashtextextended(${`${identity.id}:${input.idempotencyKey}`}, 0))
      `;
      const [existingRequest] = await transaction<
        { operation: string; request_hash: string; response: unknown }[]
      >`
        SELECT operation, request_hash, response
        FROM idempotency_record
        WHERE participant_id = ${identity.id}::uuid
          AND idempotency_key = ${input.idempotencyKey}::uuid
      `;
      if (existingRequest) {
        if (existingRequest.operation !== kind || existingRequest.request_hash !== hash) {
          throw new TravelConflictError("This idempotency key was already used for a different request.");
        }
        return readIdempotencyResponse(existingRequest.response);
      }

      const [session] = await transaction<
        {
          activity_id: string;
          stop_id: string;
          status: string;
          destination_latitude: number;
          destination_longitude: number;
          geofence_radius_m: number;
          distance_m: number;
        }[]
      >`
        SELECT
          a.id AS activity_id,
          s.id AS stop_id,
          ts.status::text AS status,
          ST_Y(s.location::geometry) AS destination_latitude,
          ST_X(s.location::geometry) AS destination_longitude,
          s.geofence_radius_m,
          ST_Distance(
            s.location,
            ST_SetSRID(ST_MakePoint(${input.fix.longitude}, ${input.fix.latitude}), 4326)::geography
          ) AS distance_m
        FROM travel_session ts
        JOIN itinerary_stop s ON s.id = ts.itinerary_stop_id
        JOIN activity a ON a.id = s.activity_id
        JOIN participation p ON p.id = ts.participation_id
          AND p.user_id = ${identity.id}::uuid
          AND p.assignment_status = 'ASSIGNED'
        WHERE ts.id = ${travelSessionId}::uuid
          AND s.is_active
          AND ts.participant_id = ${identity.id}::uuid
        FOR UPDATE OF ts
      `;
      if (!session) throw new TravelNotFoundError();
      validateFreshLocation(input.fix, new Date().getTime());

      const [alreadySubmitted] = await transaction<
        { id: string; server_received_at: Date; geofence_status: string; validation_status: string; review_flags: string[] }[]
      >`
        SELECT id, server_received_at, geofence_status::text, validation_status::text, review_flags
        FROM check_in
        WHERE travel_session_id = ${travelSessionId}::uuid AND kind = ${kind}::milestone_kind
      `;
      if (alreadySubmitted) {
        return {
          checkInId: alreadySubmitted.id,
          kind,
          status: session.status,
          serverReceivedAt: alreadySubmitted.server_received_at.toISOString(),
          geofenceStatus: alreadySubmitted.geofence_status,
          validationStatus: alreadySubmitted.validation_status,
          reviewFlags: alreadySubmitted.review_flags,
          duplicateSubmission: true,
        };
      }

      let arrivalExists = false;
      if (kind === "CHECKOUT") {
        const [arrival] = await transaction<{ id: string }[]>`
          SELECT id FROM check_in
          WHERE travel_session_id = ${travelSessionId}::uuid AND kind = 'ARRIVAL'
        `;
        arrivalExists = Boolean(arrival);
      }
      assertMilestoneAllowed(session.status, kind, arrivalExists);

      const [receipt] = await transaction<{ received_at: Date }[]>`
        SELECT clock_timestamp() AS received_at
      `;
      const geofenceStatus =
        session.distance_m + input.fix.accuracyM <= session.geofence_radius_m
          ? "INSIDE"
          : session.distance_m - input.fix.accuracyM > session.geofence_radius_m
            ? "OUTSIDE"
            : "UNCERTAIN";
      const reviewFlags = getReviewFlags(
        input.fix.accuracyM,
        geofenceStatus,
        Boolean(photo),
        receipt.received_at.getTime(),
        input.fix.gpsAcquiredAt,
      );

      const storedEvidence = photo
        ? await storeEvidence({
          bytes: photo.bytes,
          declaredContentType: photo.contentType,
          participantId: identity.id,
          activityId: session.activity_id,
          travelSessionId,
          kind,
          latitude: input.fix.latitude,
          longitude: input.fix.longitude,
          serverReceivedAt: receipt.received_at,
        })
        : null;
      storedState.evidence = storedEvidence;

      const [checkIn] = await transaction<
        { id: string; server_received_at: Date; geofence_status: string; validation_status: string; review_flags: string[] }[]
      >`
        INSERT INTO check_in (
          travel_session_id, kind, idempotency_key, location, accuracy_m, gps_acquired_at,
          server_received_at, geofence_status, validation_status, review_flags
        )
        VALUES (
          ${travelSessionId}::uuid,
          ${kind}::milestone_kind,
          ${input.idempotencyKey}::uuid,
          ST_SetSRID(ST_MakePoint(${input.fix.longitude}, ${input.fix.latitude}), 4326)::geography,
          ${input.fix.accuracyM},
          ${input.fix.gpsAcquiredAt}::timestamptz,
          ${receipt.received_at},
          ${geofenceStatus}::geofence_status,
          ${reviewFlags.length ? "FLAGGED_FOR_REVIEW" : "PENDING"}::validation_status,
          ${reviewFlags}
        )
        RETURNING
          id, server_received_at, geofence_status::text,
          validation_status::text, review_flags
      `;

      if (storedEvidence) {
        await transaction`
          INSERT INTO evidence (
            id, check_in_id, original_object_key, stamped_object_key,
            original_sha256, stamped_sha256, content_type,
            original_size_bytes, stamped_size_bytes
          )
          VALUES (
            ${storedEvidence.id}::uuid,
            ${checkIn.id}::uuid,
            ${storedEvidence.originalObjectKey},
            ${storedEvidence.stampedObjectKey},
            ${storedEvidence.originalSha256},
            ${storedEvidence.stampedSha256},
            ${storedEvidence.contentType},
            ${storedEvidence.originalSizeBytes},
            ${storedEvidence.stampedSizeBytes}
          )
        `;
      }

      const status = kind === "ARRIVAL" ? "ARRIVAL_SUBMITTED" : "CHECKOUT_SUBMITTED";
      await transaction`
        UPDATE travel_session
        SET status = ${status}::travel_session_status
        WHERE id = ${travelSessionId}::uuid
      `;
      const response = {
        checkInId: checkIn.id,
        evidenceId: storedState.evidence?.id ?? null,
        kind,
        status,
        serverReceivedAt: checkIn.server_received_at.toISOString(),
        geofenceStatus: checkIn.geofence_status,
        validationStatus: checkIn.validation_status,
        reviewFlags: checkIn.review_flags,
        dwellSeconds: kind === "CHECKOUT"
          ? await readDwellSeconds(transaction, travelSessionId, checkIn.server_received_at)
          : null,
      };
      await transaction`
        INSERT INTO idempotency_record (
          participant_id, idempotency_key, operation, request_hash, resource_id, response
        )
        VALUES (
          ${identity.id}::uuid,
          ${input.idempotencyKey}::uuid,
          ${kind},
          ${hash},
          ${checkIn.id}::uuid,
          ${JSON.stringify(response)}::text::jsonb
        )
      `;
      await transaction`
        INSERT INTO audit_log (actor_id, action, resource_type, resource_id, details)
        VALUES (
          ${identity.id}::uuid,
          ${kind === "ARRIVAL" ? "ARRIVAL_SUBMITTED" : "CHECKOUT_SUBMITTED"},
          'check_in',
          ${checkIn.id},
          ${JSON.stringify({
            travelSessionId,
            evidenceAttached: Boolean(storedState.evidence),
            geofenceStatus,
            reviewFlags,
          })}::text::jsonb
        )
      `;
      await transaction`
        INSERT INTO app_notification (recipient_id, check_in_id)
        SELECT DISTINCT recipient.id, ${checkIn.id}::uuid
        FROM role_assignment assignment
        JOIN app_user recipient ON recipient.id = assignment.user_id
        JOIN app_user participant ON participant.id = ${identity.id}::uuid
        WHERE recipient.status = 'ACTIVE'
          AND (recipient.account_expires_at IS NULL OR recipient.account_expires_at > now())
          AND (
            (assignment.role = 'VPSAS' AND assignment.college_id IS NULL)
            OR (
              assignment.role = 'DEAN'
              AND assignment.college_id = participant.college_id
              AND EXISTS (
                SELECT 1
                FROM activity_college ac
                WHERE ac.activity_id = ${session.activity_id}::uuid
                  AND ac.college_id = assignment.college_id
              )
            )
          )
        ON CONFLICT (recipient_id, check_in_id) DO NOTHING
      `;
      return response;
    });
    storedState.evidence = null;
    return response;
  } catch (error) {
    if (storedState.evidence) {
      try {
        await deleteStoredEvidence([
          storedState.evidence.originalObjectKey,
          storedState.evidence.stampedObjectKey,
        ]);
      } catch (cleanupError) {
        console.error("Failed to remove orphaned evidence objects after milestone submission failure.", cleanupError);
      }
    }
    if (error instanceof EvidenceStorageNotConfiguredError) {
      throw error;
    }
    throw error;
  }
}

async function readDwellSeconds(
  transaction: TransactionSql,
  travelSessionId: string,
  checkoutAt: Date,
): Promise<number | null> {
  const [arrival] = await transaction<{ server_received_at: Date }[]>`
    SELECT server_received_at
    FROM check_in
    WHERE travel_session_id = ${travelSessionId}::uuid AND kind = 'ARRIVAL'
  `;
  return arrival
    ? Math.max(0, Math.floor((checkoutAt.getTime() - arrival.server_received_at.getTime()) / 1000))
    : null;
}

export function mapTravelError(error: unknown) {
  if (error instanceof TravelConflictError) {
    return { status: 409, message: error.message };
  }
  if (error instanceof TravelNotFoundError) {
    return { status: 404, message: error.message };
  }
  if (error instanceof EvidenceStorageNotConfiguredError) {
    return { status: 503, message: error.message };
  }
  if (error instanceof EvidenceValidationError || error instanceof LocationValidationError) {
    return { status: 400, message: error.message };
  }
  return null;
}

export function travelApiError(error: unknown) {
  const mapped = mapTravelError(error);
  if (mapped) {
    return privateJson({ error: mapped.message }, mapped.status);
  }
  return apiErrorResponse(error);
}
