const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const fetch = require('node-fetch');

const app = express();
const PORT = process.env.PORT || 3000;

// 1. Essencial para pegar o IP real na Vercel
app.set("trust proxy", 1);

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// 2. Arquivo que guarda os IPs
const USAGE_FILE = path.join(__dirname, 'ips-bloqueados.json');

function carregarDados() {
    try {
        if (fs.existsSync(USAGE_FILE)) return JSON.parse(fs.readFileSync(USAGE_FILE, 'utf8'));
    } catch (e) {}
    return {};
}

function salvarDados(data) {
    fs.writeFileSync(USAGE_FILE, JSON.stringify(data, null, 2), 'utf8');
}

// 3. Rota de Geração com Proteção de IP
app.post('/gerar-proposta', async (req, res) => {
    const { solicitacao, diferenciais } = req.body;
    const ip = req.ip;
    const agora = Date.now();
    const trintaDias = 30 * 24 * 60 * 60 * 1000;
    const dados = carregarDados();

    // Verifica se o IP já existe e se está bloqueado
    if (dados[ip]) {
        if (agora - dados[ip].data <= trintaDias && dados[ip].usos >= 3) {
            return res.status(429).json({ erro: "Limite gratuito atingido. Assine para continuar usando." });
        }
        if (agora - dados[ip].data > trintaDias) {
            dados[ip] = { usos: 1, data: agora };
        } else {
            dados[ip].usos += 1;
        }
    } else {
        dados[ip] = { usos: 1, data: agora };
    }
    salvarDados(dados);

    // Gera a proposta
    try {
        const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                model: "meta-llama/llama-3.3-70b-instruct",
                provider: "groq",
                messages: [{ role: "user", content: `Gere uma proposta... ${solicitacao}` }]
            })
        });
        const data = await response.json();
        res.json({ proposta: data.choices[0].message.content });
    } catch (error) {
        res.status(500).json({ erro: "Falha ao gerar." });
    }
});

app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));