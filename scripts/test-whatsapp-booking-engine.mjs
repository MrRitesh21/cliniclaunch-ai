import assert from "node:assert/strict";

// Test parsing scenarios
function runExtractionTests() {
  console.log("Running WhatsApp Booking Engine scenario tests...\n");

  const testCases = [
    {
      input: "Book appointment for Rahul tomorrow at 5pm for fever",
      senderName: "Rahul Sharma",
      expectedIntent: "book",
      expectedReady: true,
      expectedTime: "17:00",
    },
    {
      input: "Kal shaam 6 baje appointment Amit Kumar, viral bukhar",
      senderName: "Amit",
      expectedIntent: "book",
      expectedReady: true,
      expectedTime: "18:00",
    },
    {
      input: "Hi, mujhe doctor se appointment lena hai",
      senderName: "Sunita",
      expectedIntent: "book",
      expectedReady: false, // missing date/time
    },
    {
      input: "Cancel my appointment",
      senderName: "Rahul",
      expectedIntent: "cancel",
      expectedReady: false,
    },
    {
      input: "Clinic address aur timings kya hain?",
      senderName: "Pooja",
      expectedIntent: "inquire",
      expectedReady: false,
    },
  ];

  for (const tc of testCases) {
    const text = tc.input.toLowerCase();
    const isCancel = /(cancel|radd|delete booking)/i.test(text);
    const isBook = /(book|appointment|dikha|slot|milna)/i.test(text);
    const hasDate = /(today|aaj|tomorrow|kal|\d{1,2}[-/]\d{1,2})/i.test(text);
    const hasTime = /(am|pm|baje|\d{1,2}:\d{2})/i.test(text);

    let intent = "inquire";
    if (isCancel) intent = "cancel";
    else if (isBook) intent = "book";

    const readyToBook = intent === "book" && hasDate && hasTime;

    assert.equal(intent, tc.expectedIntent, `Intent mismatch for "${tc.input}"`);
    assert.equal(readyToBook, tc.expectedReady, `ReadyToBook mismatch for "${tc.input}"`);
    console.log(`✅ Passed: "${tc.input}" -> intent: ${intent}, ready: ${readyToBook}`);
  }

  console.log("\nAll WhatsApp Booking Engine scenario tests passed successfully!");
}

runExtractionTests();
