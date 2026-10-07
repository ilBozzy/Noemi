const SUPABASE_URL = 'https://neqsjdbzyexrdvtwscky.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5lcXNqZGJ6eWV4cmR2dHdzY2t5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTEzNTk0MDgsImV4cCI6MjEwNjkzNTQwOH0.s8wMHG2UG2duW7fm7lWGWrLyx7feQSXJwmoQkaYF0OY';

// Capisce se sta girando su iOS o su Zen
const isIOS = navigator.userAgent.includes('iPhone') || navigator.userAgent.includes('iPad');
const currentDevice = isIOS ? 'safari' : 'zen';
const targetDevice = isIOS ? 'zen' : 'safari';

// Memoria per evitare loop e non aprire schede già elaborate
const noemiOpenedTabs = new Set();
const processedIds = new Set(); 

// --- DA BROWSER A DATABASE ---
browser.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
    // Intercetta solo i siti veri (ignora le pagine di sistema o vuote)
    if (changeInfo.status === 'complete' && tab.url && tab.url.startsWith('http')) {
        
        if (noemiOpenedTabs.has(tab.url)) {
            noemiOpenedTabs.delete(tab.url); // Lo toglie dalla lista d'attesa
            return;
        }

        console.log(`[Noemi] Invio nel flusso: ${tab.title}`);
        fetch(`${SUPABASE_URL}/rest/v1/synced_tabs`, {
            method: 'POST',
            headers: {
                'apikey': SUPABASE_KEY,
                'Authorization': `Bearer ${SUPABASE_KEY}`,
                'Content-Type': 'application/json',
                'Prefer': 'return=minimal'
            },
            body: JSON.stringify({ url: tab.url, title: tab.title, source_device: currentDevice })
        }).catch(err => console.error("Errore di invio:", err));
    }
});

// --- DA DATABASE A BROWSER (Polling nativo) ---
async function controllaFlusso() {
    try {
        // Chiede a Supabase le ultime 5 tab del dispositivo opposto
        const response = await fetch(`${SUPABASE_URL}/rest/v1/synced_tabs?source_device=eq.${targetDevice}&order=created_at.desc&limit=5`, {
            headers: {
                'apikey': SUPABASE_KEY,
                'Authorization': `Bearer ${SUPABASE_KEY}`
            }
        });
        
        const tabs = await response.json();
        
        for (let tab of tabs) {
            // Se è un ID nuovo, apre la scheda!
            if (!processedIds.has(tab.id)) {
                processedIds.add(tab.id); // Segna come processato
                
                // Salta l'apertura al primissimo avvio per non aprirti schede vecchie
                if (processedIds.size > 5) {
                    console.log(`[Noemi] Tab in arrivo da ${targetDevice}: ${tab.title}`);
                    noemiOpenedTabs.add(tab.url); // Lo marca per non rimandarlo indietro
                    browser.tabs.create({ url: tab.url, active: false });
                }
            }
        }
    } catch (error) {
        // Ignora gli errori di rete temporanei, resta chill
    }
}

// Inizializza il battito cardiaco di Noemi (legge il flusso ogni 3 secondi)
setInterval(controllaFlusso, 3000);
controllaFlusso(); // Esegue la prima lettura subito