import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { crypto } from "https://deno.land/std@0.168.0/crypto/mod.ts";

console.log("Fungsi digiflazz-proxy diinisialisasi.");

// Header CORS untuk memungkinkan akses dari browser
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Fungsi utama yang akan dijalankan oleh Supabase
serve(async (req) => {
  const requestTimestamp = new Date().toISOString();
  console.log(`[${requestTimestamp}] Menerima request: ${req.method}`);

  // Menangani preflight request untuk CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Mengambil kredensial Digiflazz dari environment variables
    const DIGIFLAZZ_USERNAME = Deno.env.get("wutuvao6VBRo");
    const DIGIFLAZZ_API_KEY = Deno.env.get("dda062ac-93c5-5f89-87e1-087f5075cc47");

    if (!DIGIFLAZZ_USERNAME || !DIGIFLAZZ_API_KEY) {
      console.error("Kesalahan Kredensial: DIGIFLAZZ_USERNAME atau DIGIFLAZZ_API_KEY tidak diatur.");
      throw new Error("Kredensial Digiflazz tidak diatur di environment variables.");
    }
    console.log("Kredensial Digiflazz berhasil dimuat.");

    // Mengambil body dari request yang dikirim client
    const requestBody = await req.json();
    const { cmd, ...rest } = requestBody;
    console.log(`Perintah diterima: '${cmd}' dengan data:`, rest);
    
    let apiUrl = '';
    let apiBody = '';

    // Menentukan aksi berdasarkan `cmd` dari client
    switch (cmd) {
      case 'balance': {
        apiUrl = 'https://api.digiflazz.com/v1/cek-saldo';
        const sign = crypto.createHash('md5').update(`${DIGIFLAZZ_USERNAME}${DIGIFLAZZ_API_KEY}depo`).digest('hex');
        console.log(`Signature untuk 'balance': ${sign}`);
        apiBody = JSON.stringify({
          cmd: 'deposit',
          username: DIGIFLAZZ_USERNAME,
          sign,
        });
        break;
      }

      case 'prepaid': {
        apiUrl = 'https://api.digiflazz.com/v1/price-list';
        const sign = crypto.createHash('md5').update(`${DIGIFLAZZ_USERNAME}${DIGIFLAZZ_API_KEY}pricelist`).digest('hex');
        console.log(`Signature untuk 'prepaid': ${sign}`);
        apiBody = JSON.stringify({
          cmd: 'price-list',
          username: DIGIFLAZZ_USERNAME,
          sign: sign,
        });
        break;
      }

      case 'topup': {
        apiUrl = 'https://api.digiflazz.com/v1/transaction';
        const { buyer_sku_code, customer_no, ref_id } = rest;

        if (!buyer_sku_code || !customer_no || !ref_id) {
          console.error("Input tidak lengkap untuk 'topup':", rest);
          return new Response(JSON.stringify({ error: 'buyer_sku_code, customer_no, dan ref_id wajib diisi.' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400,
          });
        }
        
        const sign = crypto.createHash('md5').update(`${DIGIFLAZZ_USERNAME}${DIGIFLAZZ_API_KEY}${ref_id}`).digest('hex');
        console.log(`Signature untuk 'topup' (ref_id: ${ref_id}): ${sign}`);
        apiBody = JSON.stringify({
          username: DIGIFLAZZ_USERNAME,
          buyer_sku_code,
          customer_no,
          ref_id,
          sign,
        });
        break;
      }

      default:
        console.error(`Perintah tidak valid diterima: ${cmd}`);
        throw new Error('Perintah tidak valid.');
    }

    console.log(`Mengirim request ke Digiflazz URL: ${apiUrl}`);
    console.log(`Body yang dikirim: ${apiBody}`);

    // Melakukan request ke API Digiflazz
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: apiBody,
    });
    
    const responseText = await response.text();
    console.log(`Respon dari Digiflazz (status: ${response.status}):`, responseText);

    if (!response.ok) {
      throw new Error(`Request ke Digiflazz gagal dengan status: ${response.status}. Body: ${responseText}`);
    }

    const data = JSON.parse(responseText);

    // Mengembalikan data dari Digiflazz ke client
    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    // Menangani error dan mengembalikannya ke client
    console.error("Terjadi error di dalam fungsi:", error.message);
    return new Response(JSON.stringify({ error: error.message, stack: error.stack }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
