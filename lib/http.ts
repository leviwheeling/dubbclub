export class HttpError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
export function failure(error: unknown) {
  if (error instanceof HttpError) return Response.json({error:error.message},{status:error.status});
  console.error("Request failed", error instanceof Error ? error.name : "Unknown error");
  return Response.json({error:"Something went wrong. Try again shortly."},{status:503});
}
