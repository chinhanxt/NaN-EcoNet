import { expect, test } from "bun:test";
import { Writable } from "node:stream";
import { createProcessLineWriter } from "../src/adapters/chatgpt-web/process-line-writer";

test("browser helper output consumes a closed Windows pipe without an uncaught error", async () => {
  const failures: Error[] = [];
  const output = new Writable({
    write(_chunk, _encoding, callback) {
      const error = Object.assign(new Error("write EOF"), { code: "EOF" });
      callback(error);
    },
  });
  const writer = createProcessLineWriter(output, error => failures.push(error));

  expect(writer.write("first event")).toBe(true);
  await new Promise(resolve => setImmediate(resolve));

  expect(failures).toHaveLength(1);
  expect(failures[0]?.message).toBe("write EOF");
  expect(writer.write("late heartbeat")).toBe(false);
});
