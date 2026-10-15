import { createTRPCReact } from "@trpc/react-query";
import type { AppRouter } from "../../../server/routers";

export const trpc = createTRPCReact<AppRouter>();

/** Tipos de las respuestas de la API (p. ej. `RouterOutputs["leads"]["detail"]`). */
export type RouterOutputs = import("@trpc/server").inferRouterOutputs<AppRouter>;
