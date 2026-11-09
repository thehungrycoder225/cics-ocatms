export async function tryRefreshTripState(refresh: () => Promise<void>): Promise<string | null> {
  try {
    await refresh();
    return null;
  } catch (error) {
    return error instanceof Error ? error.message : "The trip state could not be refreshed.";
  }
}
