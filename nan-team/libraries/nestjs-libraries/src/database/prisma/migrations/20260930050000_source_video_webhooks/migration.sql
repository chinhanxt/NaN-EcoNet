CREATE TABLE "SourceVideoWebhookDelivery" (
    "jobId" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "targetCiphertext" TEXT NOT NULL,
    "secretCiphertext" TEXT NOT NULL,
    "payload" TEXT,
    "status" TEXT NOT NULL DEFAULT 'waiting',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "epoch" INTEGER NOT NULL DEFAULT 0,
    "leaseOwner" TEXT,
    "leaseUntil" TIMESTAMP(3),
    "lastStatusCode" INTEGER,
    "lastError" TEXT,
    "deliveredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SourceVideoWebhookDelivery_pkey" PRIMARY KEY ("jobId"),
    CONSTRAINT "SourceVideoWebhookDelivery_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "SourceVideoJob"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "SourceVideoWebhookDelivery_status_nextAttemptAt_idx" ON "SourceVideoWebhookDelivery"("status", "nextAttemptAt");
CREATE INDEX "SourceVideoWebhookDelivery_orgId_jobId_idx" ON "SourceVideoWebhookDelivery"("orgId", "jobId");
