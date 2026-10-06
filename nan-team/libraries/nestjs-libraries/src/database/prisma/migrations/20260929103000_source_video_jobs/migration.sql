-- CreateTable
CREATE TABLE "SourceVideoJob" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "revision" INTEGER NOT NULL,
    "parentJobId" TEXT,
    "workflowId" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "inputHash" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "stage" TEXT NOT NULL DEFAULT 'queued',
    "progress" INTEGER NOT NULL DEFAULT 0,
    "receipt" JSONB NOT NULL,
    "sourceSha256" TEXT,
    "engineSha256" TEXT,
    "workflowStarted" BOOLEAN NOT NULL DEFAULT false,
    "cancellationRequested" BOOLEAN NOT NULL DEFAULT false,
    "epoch" INTEGER NOT NULL DEFAULT 0,
    "leaseOwner" TEXT,
    "leaseUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SourceVideoJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SourceVideoRevision" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "jobId" TEXT NOT NULL,
    "input" JSONB NOT NULL,
    "plan" JSONB,
    "planVersion" INTEGER NOT NULL DEFAULT 0,
    "approvedPlan" JSONB,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SourceVideoRevision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SourceVideoClip" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "clipId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "artifactPath" TEXT NOT NULL,
    "cleanPath" TEXT,
    "sha256" TEXT NOT NULL,
    "metadata" JSONB NOT NULL,
    "mediaId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SourceVideoClip_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SourceVideoPublication" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "clipId" TEXT NOT NULL,
    "mediaId" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "storagePath" TEXT NOT NULL,
    "sha256" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'prepared',
    "epoch" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SourceVideoPublication_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SourceVideoJob_workflowId_key" ON "SourceVideoJob"("workflowId");

-- CreateIndex
CREATE INDEX "SourceVideoJob_orgId_createdAt_idx" ON "SourceVideoJob"("orgId", "createdAt");

-- CreateIndex
CREATE INDEX "SourceVideoJob_workflowStarted_status_idx" ON "SourceVideoJob"("workflowStarted", "status");

-- CreateIndex
CREATE UNIQUE INDEX "SourceVideoJob_orgId_idempotencyKey_key" ON "SourceVideoJob"("orgId", "idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "SourceVideoJob_orgId_projectId_revision_key" ON "SourceVideoJob"("orgId", "projectId", "revision");

-- CreateIndex
CREATE UNIQUE INDEX "SourceVideoRevision_jobId_key" ON "SourceVideoRevision"("jobId");

-- CreateIndex
CREATE UNIQUE INDEX "SourceVideoRevision_orgId_projectId_version_key" ON "SourceVideoRevision"("orgId", "projectId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "SourceVideoClip_mediaId_key" ON "SourceVideoClip"("mediaId");

-- CreateIndex
CREATE INDEX "SourceVideoClip_orgId_jobId_idx" ON "SourceVideoClip"("orgId", "jobId");

-- CreateIndex
CREATE UNIQUE INDEX "SourceVideoClip_jobId_clipId_key" ON "SourceVideoClip"("jobId", "clipId");

-- CreateIndex
CREATE UNIQUE INDEX "SourceVideoPublication_mediaId_key" ON "SourceVideoPublication"("mediaId");

-- CreateIndex
CREATE UNIQUE INDEX "SourceVideoPublication_storageKey_key" ON "SourceVideoPublication"("storageKey");

-- CreateIndex
CREATE INDEX "SourceVideoPublication_orgId_status_idx" ON "SourceVideoPublication"("orgId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "SourceVideoPublication_jobId_clipId_key" ON "SourceVideoPublication"("jobId", "clipId");

-- AddForeignKey
ALTER TABLE "SourceVideoJob" ADD CONSTRAINT "SourceVideoJob_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SourceVideoRevision" ADD CONSTRAINT "SourceVideoRevision_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "SourceVideoJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SourceVideoClip" ADD CONSTRAINT "SourceVideoClip_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "SourceVideoJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SourceVideoPublication" ADD CONSTRAINT "SourceVideoPublication_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "SourceVideoJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;
