import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { randomUUID } from "crypto";

const prisma = new PrismaClient();

async function main() {
  const users = [
    { username: "alice", pin: "1111" },
    { username: "bob", pin: "2222" },
  ];

  for (const u of users) {
    const existing = await prisma.user.findUnique({ where: { username: u.username } });
    if (!existing) {
      const pinHash = await bcrypt.hash(u.pin, 10);
      await prisma.user.create({
        data: {
          id: randomUUID(),
          username: u.username,
          pinHash,
        },
      });
      console.log(`Created user: ${u.username} with PIN: ${u.pin}`);
    } else {
      console.log(`User ${u.username} already exists.`);
    }
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
