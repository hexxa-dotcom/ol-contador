const { createClient } = require('@supabase/supabase-js');
const sb = createClient('https://vosuzicovnyvvtzvpqdz.supabase.co', 'sb_publishable_CUQGA9sJ6EzSIA_adBSe9A_G5u-cJQ2');
async function run() {
  const res = await sb.from('mensagens').insert({ cliente_id: 'ana-silva', sender: 'client', text: 'test', type: 'internal', time: '10:00' }).select();
  console.log(res);
}
run();
