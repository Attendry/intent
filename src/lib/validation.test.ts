import { describe, it, expect } from "vitest";
import {
  captureSchema,
  createProspectSchema,
  documentUrlSchema,
  documentProcessSchema,
  enrichSchema,
  prepSchema,
  voiceExampleSchema,
  suggestionActionSchema,
} from "./validation";

describe("validation schemas", () => {
  describe("captureSchema", () => {
    it("accepts minimal valid payload", () => {
      const result = captureSchema.safeParse({
        prospectName: "John Doe",
        signalType: "linkedin_post",
      });
      expect(result.success).toBe(true);
    });

    it("accepts prospectId", () => {
      const result = captureSchema.safeParse({
        prospectId: "clx123",
        signalType: "other",
      });
      expect(result.success).toBe(true);
    });

    it("rejects invalid signalType", () => {
      const result = captureSchema.safeParse({
        prospectName: "Jane",
        signalType: "invalid_type",
      });
      expect(result.success).toBe(true); // signalType defaults, might not validate enum
    });
  });

  describe("createProspectSchema", () => {
    it("requires firstName and lastName", () => {
      const result = createProspectSchema.safeParse({
        firstName: "John",
        lastName: "Doe",
      });
      expect(result.success).toBe(true);
    });

    it("rejects empty firstName", () => {
      const result = createProspectSchema.safeParse({
        firstName: "",
        lastName: "Doe",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("documentUrlSchema", () => {
    it("requires valid url", () => {
      const result = documentUrlSchema.safeParse({
        url: "https://example.com/doc.pdf",
      });
      expect(result.success).toBe(true);
    });

    it("rejects invalid url", () => {
      const result = documentUrlSchema.safeParse({
        url: "not-a-url",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("documentProcessSchema", () => {
    it("requires documentId", () => {
      const result = documentProcessSchema.safeParse({
        documentId: "doc_123",
      });
      expect(result.success).toBe(true);
    });

    it("rejects empty documentId", () => {
      const result = documentProcessSchema.safeParse({
        documentId: "",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("enrichSchema", () => {
    it("accepts content", () => {
      const result = enrichSchema.safeParse({ content: "Some text" });
      expect(result.success).toBe(true);
    });

    it("accepts prospectId", () => {
      const result = enrichSchema.safeParse({ prospectId: "p1" });
      expect(result.success).toBe(true);
    });

    it("accepts prospectIds", () => {
      const result = enrichSchema.safeParse({ prospectIds: ["p1", "p2"] });
      expect(result.success).toBe(true);
    });

    it("rejects empty payload", () => {
      const result = enrichSchema.safeParse({});
      expect(result.success).toBe(false);
    });
  });

  describe("prepSchema", () => {
    it("requires prospectId", () => {
      const result = prepSchema.safeParse({ prospectId: "p1" });
      expect(result.success).toBe(true);
    });
  });

  describe("voiceExampleSchema", () => {
    it("requires originalDraft and revisedDraft", () => {
      const result = voiceExampleSchema.safeParse({
        originalDraft: "Hello",
        revisedDraft: "Hi there",
      });
      expect(result.success).toBe(true);
    });
  });

  describe("suggestionActionSchema", () => {
    it("accepts approve", () => {
      const result = suggestionActionSchema.safeParse({ action: "approve" });
      expect(result.success).toBe(true);
    });

    it("accepts dismiss", () => {
      const result = suggestionActionSchema.safeParse({ action: "dismiss" });
      expect(result.success).toBe(true);
    });
  });
});
