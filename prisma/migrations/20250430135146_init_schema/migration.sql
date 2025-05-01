-- CreateTable
CREATE TABLE "User" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'USER',
    "clinicName" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Appointment" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "patientId" INTEGER NOT NULL,
    "clinicAdminId" INTEGER NOT NULL,
    "startTime" DATETIME NOT NULL,
    "endTime" DATETIME NOT NULL,
    "reason" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'SCHEDULED',
    "priority" TEXT NOT NULL DEFAULT 'NORMAL',
    "estimatedDuration" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Appointment_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Appointment_clinicAdminId_fkey" FOREIGN KEY ("clinicAdminId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AdminTask" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "description" TEXT NOT NULL,
    "duration" INTEGER NOT NULL,
    "deadline" INTEGER NOT NULL,
    "profit" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "adminId" INTEGER NOT NULL,
    CONSTRAINT "AdminTask_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SupplyItem" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "cost" REAL NOT NULL,
    "value" REAL NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "adminId" INTEGER NOT NULL,
    CONSTRAINT "SupplyItem_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ClinicNode" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "adminId" INTEGER NOT NULL,
    CONSTRAINT "ClinicNode_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ClinicEdge" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "nodeAId" INTEGER NOT NULL,
    "nodeBId" INTEGER NOT NULL,
    "cost" REAL NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "adminId" INTEGER NOT NULL,
    CONSTRAINT "ClinicEdge_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ClinicEdge_nodeAId_fkey" FOREIGN KEY ("nodeAId") REFERENCES "ClinicNode" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ClinicEdge_nodeBId_fkey" FOREIGN KEY ("nodeBId") REFERENCES "ClinicNode" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "Appointment_patientId_idx" ON "Appointment"("patientId");

-- CreateIndex
CREATE INDEX "Appointment_clinicAdminId_idx" ON "Appointment"("clinicAdminId");

-- CreateIndex
CREATE INDEX "Appointment_startTime_idx" ON "Appointment"("startTime");

-- CreateIndex
CREATE INDEX "AdminTask_adminId_idx" ON "AdminTask"("adminId");

-- CreateIndex
CREATE INDEX "SupplyItem_adminId_idx" ON "SupplyItem"("adminId");

-- CreateIndex
CREATE UNIQUE INDEX "ClinicNode_name_key" ON "ClinicNode"("name");

-- CreateIndex
CREATE INDEX "ClinicNode_adminId_idx" ON "ClinicNode"("adminId");

-- CreateIndex
CREATE INDEX "ClinicEdge_adminId_idx" ON "ClinicEdge"("adminId");

-- CreateIndex
CREATE INDEX "ClinicEdge_nodeAId_idx" ON "ClinicEdge"("nodeAId");

-- CreateIndex
CREATE INDEX "ClinicEdge_nodeBId_idx" ON "ClinicEdge"("nodeBId");

-- CreateIndex
CREATE UNIQUE INDEX "ClinicEdge_adminId_nodeAId_nodeBId_key" ON "ClinicEdge"("adminId", "nodeAId", "nodeBId");
