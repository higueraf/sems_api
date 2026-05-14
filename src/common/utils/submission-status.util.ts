import { SubmissionStatus } from '../enums/submission-status.enum';

/**
 * Priority order for progressive (non-terminal) states.
 * Lower number = less advanced.
 */
const PROGRESSIVE_PRIORITY: Partial<Record<SubmissionStatus, number>> = {
  [SubmissionStatus.RECEIVED]:             0,
  [SubmissionStatus.UNDER_REVIEW]:         1,
  [SubmissionStatus.REVISION_REQUESTED]:   2,
  [SubmissionStatus.APPROVED]:             3,
  [SubmissionStatus.SCHEDULED]:            4,
  [SubmissionStatus.EXECUTED]:             5,
  [SubmissionStatus.CERTIFICATE_SENT]:     6,
};

const TERMINAL: Set<string> = new Set([
  SubmissionStatus.REJECTED,
  SubmissionStatus.WITHDRAWN,
]);

/**
 * Computes the aggregate global status from individual productStatuses
 * using pessimistic aggregation:
 *   - Global = least-advanced status among all product types
 *   - certificate_sent only when ALL product types are certificate_sent
 *   - under_review if any product type is still under review, etc.
 *
 * Terminal states (rejected / withdrawn) are ignored in the aggregation
 * unless every product type is terminal.
 */
export function computeGlobalStatus(
  productStatuses: Record<string, string> | null | undefined,
): SubmissionStatus {
  const values = Object.values(productStatuses ?? {});
  if (values.length === 0) return SubmissionStatus.RECEIVED;

  const progressive = values.filter((st) => !TERMINAL.has(st));

  // All terminal → return first terminal value
  if (progressive.length === 0) return values[0] as SubmissionStatus;

  // Return the least advanced progressive status
  let minPriority = Infinity;
  let minStatus = progressive[0] as SubmissionStatus;

  for (const st of progressive) {
    const p = PROGRESSIVE_PRIORITY[st as SubmissionStatus] ?? 0;
    if (p < minPriority) {
      minPriority = p;
      minStatus = st as SubmissionStatus;
    }
  }

  return minStatus;
}
