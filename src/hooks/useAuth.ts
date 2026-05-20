// Shim de compatibilidade — re-exporta o hook canônico do AuthContext.
// Mantém imports legados de `@/hooks/useAuth` funcionando sem duplicar lógica.
export { useAuth } from "@/contexts/AuthContext";
export type { } from "@/contexts/AuthContext";
