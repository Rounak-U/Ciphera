const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function wipe() {
  await prisma.message.deleteMany({});
  await prisma.sessionKeyMetadata.deleteMany({});
  await prisma.conversationMember.deleteMany({});
  await prisma.conversation.deleteMany({});
  console.log("Wiped all old conversations to clear cryptographic constraint errors.");
  process.exit(0);
}

wipe();
