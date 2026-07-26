// Generates the exact wire payload the TanStack client would send, using the
// project's own seroval + encode, so QA probes hit the real auth path instead
// of dying in deserialization. Plain-JSON args need no seroval plugins.
import { toJSONAsync } from "seroval";
import { encode } from "@tanstack/router-core";

const data = JSON.parse(process.argv[2] ?? "null");

if (data === null || data === undefined) {
  console.log(JSON.stringify({ query: "", body: null }));
} else {
  const serialized = JSON.stringify(await toJSONAsync({ data }));
  console.log(JSON.stringify({ query: encode({ payload: serialized }), body: serialized }));
}
