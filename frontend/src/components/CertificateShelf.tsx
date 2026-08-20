import type { Certificate } from '@/types';

interface CertificateShelfProps {
  certificates: Certificate[];
}

const formatIssued = (value?: string): string => {
  if (!value) {
    return '';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
};

/**
 * Earned certificates. Rendered even when empty, because the empty state is what
 * tells a learner the reward exists and what unlocks it — hiding the panel until
 * the first certificate arrives removes the incentive entirely.
 */
export default function CertificateShelf({ certificates }: CertificateShelfProps) {
  return (
    <div className="surface p-5">
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="orb-label">Certificates</p>
          <p className="mt-1 text-sm text-content-muted">
            <span className="font-bold text-content">{certificates.length}</span> earned
          </p>
        </div>
        <span className="text-xl" aria-hidden="true">
          🎓
        </span>
      </div>

      {certificates.length > 0 ? (
        <ul className="mt-4 space-y-2.5">
          {certificates.map((certificate) => (
            <li
              key={certificate.id}
              className="rounded-2xl border border-brand-400/40 bg-brand-500/10 px-3.5 py-3 transition duration-300 hover:shadow-glow"
            >
              <p className="text-sm font-bold leading-snug text-content">
                {certificate.courseTitle ?? 'Course certificate'}
              </p>
              <p className="mt-1 font-mono text-[10.5px] uppercase tracking-wider text-content-subtle">
                {certificate.certificateNumber}
              </p>
              {certificate.issuedAt ? (
                <p className="mt-0.5 text-[11px] text-content-subtle">
                  Issued {formatIssued(certificate.issuedAt)}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-4 rounded-2xl border border-dashed border-hairline px-3.5 py-4 text-xs leading-relaxed text-content-subtle">
          Finish every lesson in a course and your certificate is issued
          automatically — no need to claim it.
        </p>
      )}
    </div>
  );
}
