// supabase/functions/digiflazz-proxy/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createHash } from "https://deno.land/std@0.110.0/hash/mod.ts";

const DIGIFLAZZ_API_URL = 'https://api.digiflazz.com/v1/';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const username = Deno.env.get('DIGIFLAZZ_USERNAME');
    const apiKey = Deno.env.get('DIGIFLAZZ_API_KEY');

    if (!username || !apiKey) {
      throw new Error("Kredensial Digiflazz tidak ditemukan di Supabase secrets.");
    }

    const { command, ...restOfBody } = await req.json();
    let endpoint = '';
    let body: any = {};
    const md5 = createHash("md5");

    switch (command) {
      case 'cek-saldo':
        endpoint = 'cek-saldo';
        body = {
          cmd: 'deposit',
          username: username,
          sign: md5.update(username + apiKey + 'depo').toString(),
        };
        break;
      
      case 'harga-pulsa':
      case 'harga-data':
      case 'harga-pln':
      case 'harga-game':
        endpoint = 'price-list';
        body = {
          cmd: 'prepaid',
          username: username,
          sign: md5.update(username + apiKey + 'pricelist').toString(),
        };
        break;

      case 'topup':
        endpoint = 'transaction';
        const refId = restOfBody.ref_id;
        if (!refId) throw new Error("ref_id wajib ada untuk topup.");
        body = {
          username: username,
          buyer_sku_code: restOfBody.buyer_sku_code,
          customer_no: restOfBody.customer_no,
          ref_id: refId,
          sign: md5.update(username + apiKey + refId).toString(),
        };
        break;
      
      default:
        throw new Error(`Perintah tidak dikenal: ${command}`);
    }

    const digiflazzResponse = await fetch(DIGIFLAZZ_API_URL + endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!digiflazzResponse.ok) {
        const errorBody = await digiflazzResponse.text();
        console.error("Digiflazz API Error:", errorBody);
        throw new Error(`Digiflazz API error: status ${digiflazzResponse.status}`);
    }

    const data = await digiflazzResponse.json();

    return new Response(
      JSON.stringify(data),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (error) {
    console.error(error);
    return new Response(
        JSON.stringify({ error: error.message }), 
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
})
