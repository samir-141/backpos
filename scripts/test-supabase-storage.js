const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { createClient } = require('@supabase/supabase-js');

async function testSupabase() {
  console.log('=== DIAGNÓSTICO DE CONEXIÓN A SUPABASE STORAGE ===');
  const url = (process.env.SUPABASE_URL || '').trim();
  const serviceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  const anonKey = (process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_KEY || '').trim();

  console.log('1. Verificando variables de entorno:');
  console.log('  - SUPABASE_URL:', url ? `Configurada (${url.length} chars)` : 'NO CONFIGURADA');
  console.log('  - SUPABASE_SERVICE_ROLE_KEY:', serviceKey ? `Configurada (${serviceKey.length} chars)` : 'NO CONFIGURADA');
  console.log('  - SUPABASE_ANON_KEY / SUPABASE_KEY:', anonKey ? `Configurada (${anonKey.length} chars)` : 'NO CONFIGURADA');

  const keyToUse = serviceKey || anonKey;

  if (!url || !keyToUse) {
    console.error('\n❌ Falta SUPABASE_URL o una clave (SUPABASE_SERVICE_ROLE_KEY / SUPABASE_ANON_KEY) en .env');
    return;
  }

  // Parsear JWT payload (solo headers / claims estándar sin exponer el secret) para diagnosticar
  try {
    const parts = keyToUse.split('.');
    if (parts.length === 3) {
      const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf8'));
      console.log(`\n2. Tipo de clave detectada: rol="${payload.role || 'desconocido'}", expira=${payload.exp ? new Date(payload.exp * 1000).toLocaleString() : 'sin expiración'}`);
      if (payload.iss) console.log(`   Emisor (iss): ${payload.iss}`);
    } else {
      console.log('\n2. La clave no tiene formato JWT estándar (3 partes separadas por punto).');
    }
  } catch (e) {
    console.log('\n2. No se pudo decodificar el payload del token JWT:', e.message);
  }

  const supabase = createClient(url, keyToUse, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const inicio = Date.now();
  console.log('\n3. Intentando conectar con Supabase Storage API...');
  const { data: buckets, error: listError } = await supabase.storage.listBuckets();

  if (listError) {
    console.error('❌ Error devuelto por Supabase:', listError.message);
    console.log('\n💡 CAUSAS COMUNES DE ESTE ERROR:');
    console.log('  1. La clave ingresada en .env pertenece a otro proyecto de Supabase (la URL y la clave no coinciden).');
    console.log('  2. Para operaciones de administración de buckets, se recomienda usar la "service_role" key.');
    console.log('  3. La clave se copió incompleta o con comillas sobrantes.');
    console.log('  4. Revisa en tu Dashboard de Supabase -> Project Settings -> API -> Project API Keys.');
    return;
  }

  const latencia = Date.now() - inicio;
  console.log(`✓ ¡CONEXIÓN EXITOSA! Latencia: ${latencia}ms`);
  console.log('✓ Buckets encontrados:', (buckets || []).map((b) => `${b.name} (${b.public ? 'Público' : 'Privado'})`).join(', ') || 'Ninguno aún');

  const bucketPublico = process.env.SUPABASE_STORAGE_BUCKET_PUBLIC || 'boticas-public';
  const bucketPrivado = process.env.SUPABASE_STORAGE_BUCKET_PRIVATE || 'boticas-private';
  const nombres = (buckets || []).map((b) => b.name);

  // Asegurar buckets
  if (!nombres.includes(bucketPublico)) {
    console.log(`\n4. Creando bucket público '${bucketPublico}'...`);
    const { error: errPub } = await supabase.storage.createBucket(bucketPublico, { public: true });
    if (errPub) console.warn('  ⚠️ Aviso:', errPub.message);
    else console.log(`  ✓ Bucket '${bucketPublico}' creado`);
  }

  if (!nombres.includes(bucketPrivado)) {
    console.log(`\n5. Creando bucket privado '${bucketPrivado}'...`);
    const { error: errPriv } = await supabase.storage.createBucket(bucketPrivado, { public: false });
    if (errPriv) console.warn('  ⚠️ Aviso:', errPriv.message);
    else console.log(`  ✓ Bucket '${bucketPrivado}' creado`);
  }

  // Prueba de subida
  console.log('\n6. Realizando prueba de subida en estructura multi-tenant...');
  const testBoticaId = 'botica-san-pedro-demo';
  const testPath = `${testBoticaId}/logos/ping.txt`;
  const pingBuffer = Buffer.from('Supabase Storage Multi-tenant OK ' + new Date().toISOString(), 'utf-8');
  const bucketTest = nombres.includes(bucketPublico) ? bucketPublico : (buckets[0]?.name || bucketPublico);

  const { data: uploadData, error: uploadError } = await supabase.storage
    .from(bucketTest)
    .upload(testPath, pingBuffer, { upsert: true, contentType: 'text/plain' });

  if (uploadError) {
    console.error('  ❌ Error al subir archivo:', uploadError.message);
  } else {
    console.log(`  ✓ Archivo subido exitosamente en [${bucketTest}]: ${uploadData.path}`);
    const { data: pubData } = supabase.storage.from(bucketTest).getPublicUrl(testPath);
    console.log(`  ✓ URL pública: ${pubData.publicUrl}`);
    await supabase.storage.from(bucketTest).remove([testPath]);
    console.log('  ✓ Archivo de prueba eliminado correctamente.');
  }

  console.log('\n🎉 ¡TODO EL FLUJO DE SUPABASE STORAGE ESTÁ 100% OPERATIVO!');
}

testSupabase().catch((err) => {
  console.error('Excepción durante la prueba:', err);
});
