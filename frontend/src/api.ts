// export const API_BASE = 'http://127.0.0.1:8000/api';
export const API_BASE = 'http://192.168.1.107:8000/api';

export async function fetchProducts() {
    const res = await fetch(`${API_BASE}/products/`);
    return res.json();
}