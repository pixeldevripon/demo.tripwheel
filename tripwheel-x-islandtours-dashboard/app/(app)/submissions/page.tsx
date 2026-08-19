import { SubmissionsView } from '@/components/submissions/submissions-view';

/**
 * The publish gate's review desk (client review #18/#19). Role decides the
 * side: the platform sees the deciding queue, an operator sees everything
 * THEY have in flight and where it stands. Independent of the Tours list on
 * purpose (client 2026-08-15): its own route, content and nav row.
 */
export default function SubmissionsPage() {
    return <SubmissionsView />;
}
