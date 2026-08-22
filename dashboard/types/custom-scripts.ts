// Mirrors backend: src/custom-scripts/dto/custom-script.dto.ts

/** Where the snippet is injected into the public page. */
export type CustomScriptPosition = 'HEAD' | 'BODY_END';

export interface CustomScript {
  id: string;
  name: string;
  description: string | null;
  position: CustomScriptPosition;
  /** Raw markup, exactly as pasted. Never rewritten by the backend. */
  code: string;
  isActive: boolean;
  displayOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCustomScriptPayload {
  name: string;
  description?: string;
  position?: CustomScriptPosition;
  code: string;
  isActive?: boolean;
}

export type UpdateCustomScriptPayload = Partial<CreateCustomScriptPayload>;

export interface ReorderCustomScriptsPayload {
  items: { id: string; displayOrder: number }[];
}
