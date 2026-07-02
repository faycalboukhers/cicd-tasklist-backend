import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { vi } from "vitest";
import testPrisma from "./setup.js";

// Mock the prisma singleton to use the test client
vi.mock("../../lib/prisma.js", () => ({
	default: testPrisma,
}));

// Import app AFTER mocking prisma
const { default: app } = await import("../../app.js");
import request from "supertest";

async function seedTask(title = "Seed", description = "Seed description") {
	return testPrisma.task.create({ data: { title, description } });
}

describe("Task API E2E Tests", () => {
	beforeEach(async () => {
		// Clean up database between tests
		await testPrisma.task.deleteMany();
	});

	afterAll(async () => {
		await testPrisma.$disconnect();
	});

	describe("POST /api/tasks", () => {
		it("should create a new task", async () => {
			const res = await request(app)
				.post("/api/tasks")
				.send({ title: "E2E Task", description: "E2E Description" });

			expect(res.status).toBe(201);
			expect(res.body).toHaveProperty("id");
			expect(res.body.title).toBe("E2E Task");
			expect(res.body.description).toBe("E2E Description");
			expect(res.body.completed).toBe(false);
		});

		it("should reject a task without title", async () => {
			const res = await request(app).post("/api/tasks").send({});

			expect(res.status).toBe(400);
			expect(res.body).toHaveProperty("error");
		});
	});

	describe("GET /api/tasks", () => {
		it("should return every task", async () => {
			await seedTask("First");
			await seedTask("Second");

			const res = await request(app).get("/api/tasks");

			expect(res.status).toBe(200);
			expect(res.body).toHaveLength(2);
		});

		it("should return an empty array when there is no task", async () => {
			const res = await request(app).get("/api/tasks");

			expect(res.status).toBe(200);
			expect(res.body).toEqual([]);
		});
	});

	describe("GET /api/tasks/:id", () => {
		it("should return a single task", async () => {
			const created = await seedTask();

			const res = await request(app).get(`/api/tasks/${created.id}`);

			expect(res.status).toBe(200);
			expect(res.body.id).toBe(created.id);
		});

		it("should return 404 for an unknown task", async () => {
			const res = await request(app).get("/api/tasks/999999");

			expect(res.status).toBe(404);
		});

		it("should return 400 for an invalid id", async () => {
			const res = await request(app).get("/api/tasks/not-a-number");

			expect(res.status).toBe(400);
		});
	});

	describe("PUT /api/tasks/:id", () => {
		it("should update an existing task", async () => {
			const created = await seedTask();

			const res = await request(app)
				.put(`/api/tasks/${created.id}`)
				.send({ completed: true });

			expect(res.status).toBe(200);
			expect(res.body.completed).toBe(true);
		});

		it("should return 404 when updating an unknown task", async () => {
			const res = await request(app)
				.put("/api/tasks/999999")
				.send({ completed: true });

			expect(res.status).toBe(404);
		});
	});

	describe("DELETE /api/tasks/:id", () => {
		it("should delete an existing task", async () => {
			const created = await seedTask();

			const res = await request(app).delete(`/api/tasks/${created.id}`);

			expect(res.status).toBe(204);

			const check = await request(app).get(`/api/tasks/${created.id}`);
			expect(check.status).toBe(404);
		});

		it("should return 404 when deleting an unknown task", async () => {
			const res = await request(app).delete("/api/tasks/999999");

			expect(res.status).toBe(404);
		});
	});
});
