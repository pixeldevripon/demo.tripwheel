/**
 * Physical assets that couple otherwise-independent tours.
 *
 * A resource is NOT inventory: it is never sold, has no price, and no traveller
 * can book one. It exists so the platform knows that two tours share a boat, a
 * guide or a fleet - which is the fact that stops both being sold to capacity
 * at the same time.
 */

export const RESOURCE_KIND = {
    BOAT: 'BOAT',
    VEHICLE: 'VEHICLE',
    JETSKI: 'JETSKI',
    GUIDE: 'GUIDE',
    EQUIPMENT: 'EQUIPMENT',
    GENERIC: 'GENERIC',
} as const;

export type ResourceKind = (typeof RESOURCE_KIND)[keyof typeof RESOURCE_KIND];

/** Operator-facing labels. The enum is never shown raw. */
export const RESOURCE_KIND_LABEL: Record<ResourceKind, string> = {
    BOAT: 'Boat',
    VEHICLE: 'Vehicle',
    JETSKI: 'Jet skis',
    GUIDE: 'Guide',
    EQUIPMENT: 'Equipment',
    GENERIC: 'Other',
};

/**
 * How a tour consumes a resource. **Inferred by the backend from the tour's own
 * pricing shape - never chosen in the UI**, and shown only as an explanation.
 */
export type ResourceConsumption = 'EXCLUSIVE' | 'EXCLUSIVE_ON_FIRST';

export const RESOURCE_MODE_EXPLANATION: Record<ResourceConsumption, string> = {
    EXCLUSIVE: 'Takes the whole thing - nothing else can run',
    EXCLUSIVE_ON_FIRST: 'First booking claims it, then fills up',
};

export interface ResourceTourSummary {
    id: string;
    name: string;
    mode: ResourceConsumption;
}

export interface Resource {
    id: string;
    name: string;
    kind: ResourceKind;
    capacity: number;
    isActive: boolean;
    notes: string | null;
    /**
     * Owning operator. Only an ADMIN ever sees more than one, and names are
     * unique per operator - so two operators may each own a "Sea Breeze" and
     * these are the only fields telling those rows apart.
     */
    operatorId: string;
    operatorName: string | null;
    tours: ResourceTourSummary[];
    createdAt: string;
}

export interface PaginatedResources {
    total: number;
    page: number;
    limit: number;
    data: Resource[];
}

export interface CreateResourcePayload {
    name: string;
    kind?: ResourceKind;
    capacity: number;
    notes?: string;
    tourIds?: string[];
}

export interface UpdateResourcePayload {
    name?: string;
    kind?: ResourceKind;
    capacity?: number;
    isActive?: boolean;
    notes?: string | null;
}
