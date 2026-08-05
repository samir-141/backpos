import * as forge from "node-forge";
import {
  existsSync,
  mkdirSync,
  writeFileSync,
} from "node:fs";
import { join, resolve } from "node:path";

const backendRoot = resolve(process.cwd());
const certsDirectory = join(backendRoot, "certs");

const privateKeyPath = join(certsDirectory, "private-key.pem");
const certificatePath = join(
  certsDirectory,
  "digital-certificate.txt",
);

function ensureCertsDirectory(): void {
  if (!existsSync(certsDirectory)) {
    mkdirSync(certsDirectory, {
      recursive: true,
    });
  }
}

function generateCertificate(): void {
  ensureCertsDirectory();

  const privateKeyExists = existsSync(privateKeyPath);
  const certificateExists = existsSync(certificatePath);

  if (privateKeyExists && certificateExists) {
    console.log(
      "Los certificados ya existen. No se generaron archivos nuevos.",
    );

    console.log(`Clave privada: ${privateKeyPath}`);
    console.log(`Certificado: ${certificatePath}`);

    return;
  }

  if (privateKeyExists !== certificateExists) {
    throw new Error(
      "La carpeta certs está incompleta. Existe solo uno de los archivos. " +
        "No se sobrescribirá automáticamente. Revisa certs antes de continuar.",
    );
  }

  console.log("Generando clave RSA de 2048 bits...");

  const keys = forge.pki.rsa.generateKeyPair({
    bits: 2048,
    workers: 2,
  });

  const certificate = forge.pki.createCertificate();

  certificate.publicKey = keys.publicKey;
  certificate.serialNumber = Date.now().toString(16);

  const now = new Date();
  const expirationDate = new Date(now);

  expirationDate.setFullYear(expirationDate.getFullYear() + 2);

  certificate.validity.notBefore = now;
  certificate.validity.notAfter = expirationDate;

  const attributes = [
    {
      name: "commonName",
      value: "Marifarma POS Development",
    },
    {
      name: "organizationName",
      value: "Marifarma",
    },
    {
      shortName: "OU",
      value: "Desarrollo",
    },
    {
      name: "countryName",
      value: "PE",
    },
  ];

  certificate.setSubject(attributes);
  certificate.setIssuer(attributes);

  certificate.setExtensions([
    {
      name: "basicConstraints",
      cA: false,
    },
    {
      name: "keyUsage",
      digitalSignature: true,
      keyEncipherment: true,
    },
    {
      name: "extKeyUsage",
      clientAuth: true,
      serverAuth: false,
      codeSigning: true,
    },
    {
      name: "subjectKeyIdentifier",
    },
  ]);

  certificate.sign(
    keys.privateKey,
    forge.md.sha256.create(),
  );

  const privateKeyPem = forge.pki.privateKeyToPem(
    keys.privateKey,
  );

  const certificatePem =
    forge.pki.certificateToPem(certificate);

  writeFileSync(privateKeyPath, privateKeyPem, {
    encoding: "utf8",
    mode: 0o600,
  });

  writeFileSync(certificatePath, certificatePem, {
    encoding: "utf8",
  });

  console.log("Certificados de desarrollo generados correctamente.");
  console.log(`Clave privada: ${privateKeyPath}`);
  console.log(`Certificado: ${certificatePath}`);
  console.log(
    "ADVERTENCIA: son certificados autofirmados de desarrollo.",
  );
}

try {
  generateCertificate();
} catch (error) {
  console.error(
    "No se pudieron generar los certificados:",
    error,
  );

  process.exitCode = 1;
}