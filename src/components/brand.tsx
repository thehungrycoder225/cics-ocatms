import Image from "next/image";
import Link from "next/link";

export function Brand({ href }: { href?: string }) {
  const content = (
    <>
      <Image alt="" className="brand-logo" height={196} src="/ocatms-brand.png" width={200} />
      <span>MarSU OCATMS</span>
    </>
  );

  return href ? (
    <Link className="brand text-lg no-underline" href={href}>{content}</Link>
  ) : (
    <div className="brand text-lg">{content}</div>
  );
}
