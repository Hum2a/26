import { Navigate, useSearchParams } from "react-router";
import { HomePage } from "./home-page";

export function HomeEntry() {
  const [params] = useSearchParams();
  return params.has("room") ? (
    <Navigate replace to={`/join?${params.toString()}`} />
  ) : (
    <HomePage />
  );
}
