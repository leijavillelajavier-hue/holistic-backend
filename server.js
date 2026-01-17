const express = require('express');
const cors = require('cors');
const axios = require('axios');
require('dotenv').config();

const app = express();

// Configuración CORS: Permite que tu HTML hable con este servidor
// En producción, cambia '*' por tu dominio real (ej. 'holistic-app.web.app')
app.use(cors({ origin: '*' })); 
app.use(express.json());

// --- CACHÉ SIMPLE PARA EL TOKEN ---
let cachedToken = null;
let tokenExpiry = 0;

async function getFatSecretToken() {
    const now = Date.now();
    if (cachedToken && now < tokenExpiry) {
        return cachedToken;
    }

    try {
        const params = new URLSearchParams();
        params.append('grant_type', 'client_credentials');
        params.append('scope', 'basic');

        const authString = Buffer.from(`${process.env.FATSECRET_ID}:${process.env.FATSECRET_SECRET}`).toString('base64');

        const response = await axios.post('https://oauth.fatsecret.com/connect/token', params, {
            headers: {
                'Authorization': `Basic ${authString}`,
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        });

        cachedToken = response.data.access_token;
        // Guardar expiración (restamos 60s por seguridad)
        tokenExpiry = now + (response.data.expires_in * 1000) - 60000;
        console.log("Nuevo Token FatSecret generado");
        return cachedToken;
    } catch (error) {
        console.error("Error obteniendo token:", error.response?.data || error.message);
        throw new Error("Fallo autenticación FatSecret");
    }
}

// --- ENDPOINT: BUSCAR ALIMENTOS ---
app.get('/api/fatsecret/search', async (req, res) => {
    const query = req.query.q;
    if (!query) return res.status(400).json({ error: "Falta el parámetro 'q'" });

    try {
        const token = await getFatSecretToken();
        const response = await axios.get('https://platform.fatsecret.com/rest/server.api', {
            headers: { 'Authorization': `Bearer ${token}` },
            params: {
                method: 'foods.search',
                search_expression: query,
                format: 'json',
                region: 'MX',
                flag_default_serving: true
            }
        });
        res.json(response.data);
    } catch (error) {
        res.status(500).json({ error: "Error buscando alimentos" });
    }
});

// --- ENDPOINT: DETALLE ALIMENTO ---
app.get('/api/fatsecret/food/:id', async (req, res) => {
    const foodId = req.params.id;
    try {
        const token = await getFatSecretToken();
        const response = await axios.get('https://platform.fatsecret.com/rest/server.api', {
            headers: { 'Authorization': `Bearer ${token}` },
            params: {
                method: 'food.get.v2',
                food_id: foodId,
                format: 'json'
            }
        });
        res.json(response.data);
    } catch (error) {
        res.status(500).json({ error: "Error obteniendo detalle" });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor Holistic corriendo en puerto ${PORT}`));