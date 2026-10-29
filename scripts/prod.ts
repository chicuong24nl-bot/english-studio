import { neon } from "@neondatabase/serverless";
import "dotenv/config";
import { drizzle } from "drizzle-orm/neon-http";

import { englishCurriculum as curriculum } from "@/content/english-curriculum";
import * as schema from "@/db/schema";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required to seed the English course.");
}

if (process.env.ALLOW_DESTRUCTIVE_SEED !== "true") {
  throw new Error(
    "Seeding replaces course content and learner progress. Set ALLOW_DESTRUCTIVE_SEED=true only for a disposable database.",
  );
}

const sql = neon(process.env.DATABASE_URL);
const db = drizzle(sql, { schema });

const main = async () => {
  try {
    console.log("Seeding English course (destructive reset enabled)");

    await db.delete(schema.userProgress);
    await db.delete(schema.userSubscription);
    await db.delete(schema.challengeOptions);
    await db.delete(schema.challenges);
    await db.delete(schema.lessons);
    await db.delete(schema.units);
    await db.delete(schema.courses);

    const [course] = await db
      .insert(schema.courses)
      .values([{ title: "English", imageSrc: "/en.svg" }])
      .returning();

    for (const [unitIndex, unitSeed] of curriculum.entries()) {
      const [unit] = await db
        .insert(schema.units)
        .values({
          courseId: course.id,
          title: unitSeed.title,
          description: unitSeed.description,
          order: unitIndex + 1,
        })
        .returning();

      for (const [lessonIndex, lessonSeed] of unitSeed.lessons.entries()) {
        const [lesson] = await db
          .insert(schema.lessons)
          .values({ unitId: unit.id, title: lessonSeed.title, order: lessonIndex + 1 })
          .returning();

        for (const [exerciseIndex, exercise] of lessonSeed.exercises.entries()) {
          const [challenge] = await db
            .insert(schema.challenges)
            .values({
              lessonId: lesson.id,
              type: exercise.type,
              question: exercise.question,
              order: exerciseIndex + 1,
            })
            .returning();

          await db.insert(schema.challengeOptions).values(
            exercise.choices.map((choice) => ({
              challengeId: challenge.id,
              text: choice.text,
              correct: choice.text === exercise.answer,
              imageSrc: choice.imageSrc,
            })),
          );
        }
      }
    }

    console.log("English course seeded successfully");
  } catch (error) {
    console.error(error);
    throw new Error("Failed to seed English course");
  }
};

void main();
