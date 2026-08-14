-- Empresas con identidad y marca, tarifas por recorrido, y flota.
--
-- Escrita a mano y no generada por `prisma migrate dev` por un motivo concreto:
-- `slug` es NOT NULL UNIQUE sobre una tabla que ya tiene filas, y un
-- `ADD COLUMN ... NOT NULL` sin default falla ahi. Prisma lo detecta y aborta.
--
-- Importa mas de lo que parece: en ECS el docker-entrypoint.sh corre
-- `prisma migrate deploy || echo "AVISO..."`, o sea que si esta migracion falla
-- el API arranca igual, con un cliente Prisma que no calza con el esquema y
-- 500 en cada endpoint tocado. La migracion tiene que estar bien a la primera.

-- CreateEnum
CREATE TYPE "CompanyKind" AS ENUM ('PRIVATE', 'MUNICIPAL');

-- CreateEnum
CREATE TYPE "PassengerType" AS ENUM ('ADULT', 'STUDENT', 'SENIOR');

-- AlterTable: todo lo nuevo lleva DEFAULT, asi que el NOT NULL es seguro sobre
-- las filas que ya existen. `slug` es la unica excepcion y va aparte, abajo.
ALTER TABLE "Company" ADD COLUMN     "assetSlug" TEXT NOT NULL DEFAULT 'generico',
ADD COLUMN     "color" TEXT NOT NULL DEFAULT '#1B5FC1',
ADD COLUMN     "kind" "CompanyKind" NOT NULL DEFAULT 'PRIVATE',
ADD COLUMN     "phone" TEXT,
ADD COLUMN     "sourceCheckedAt" TIMESTAMP(3),
ADD COLUMN     "sourceUrl" TEXT,
ADD COLUMN     "website" TEXT;

-- slug en tres pasos.
-- 1) nace nullable, para que las filas existentes no violen la restriccion
ALTER TABLE "Company" ADD COLUMN "slug" TEXT;

-- 2) se rellena. La empresa que pudo haber sembrado la version anterior se
--    identifica por su rut; cualquier otra creada a mano hereda su id, que es
--    unico por construccion y por lo tanto no puede colisionar en el indice.
UPDATE "Company" SET "slug" = 'bupesa' WHERE "rut" = '96.812.340-7';
UPDATE "Company" SET "slug" = "id" WHERE "slug" IS NULL;

-- 3) recien ahora se exige
ALTER TABLE "Company" ALTER COLUMN "slug" SET NOT NULL;

-- AlterTable
ALTER TABLE "Trip" ADD COLUMN     "busId" TEXT;

-- CreateTable
CREATE TABLE "Fare" (
    "id" TEXT NOT NULL,
    "routeId" TEXT NOT NULL,
    "passengerType" "PassengerType" NOT NULL,
    "amountClp" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Fare_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Bus" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "plate" TEXT NOT NULL,
    "seats" INTEGER,
    "assetSlug" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Bus_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Fare_routeId_passengerType_key" ON "Fare"("routeId", "passengerType");

-- CreateIndex
CREATE UNIQUE INDEX "Bus_companyId_plate_key" ON "Bus"("companyId", "plate");

-- CreateIndex
CREATE UNIQUE INDEX "Company_slug_key" ON "Company"("slug");

-- AddForeignKey
ALTER TABLE "Fare" ADD CONSTRAINT "Fare_routeId_fkey" FOREIGN KEY ("routeId") REFERENCES "Route"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bus" ADD CONSTRAINT "Bus_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Trip" ADD CONSTRAINT "Trip_busId_fkey" FOREIGN KEY ("busId") REFERENCES "Bus"("id") ON DELETE SET NULL ON UPDATE CASCADE;
