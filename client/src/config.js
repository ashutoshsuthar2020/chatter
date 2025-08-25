
// Standard: Use ingress domain by default for API and WS URLs
const INGRESS_DOMAIN = process.env.REACT_APP_INGRESS_DOMAIN;
if (!INGRESS_DOMAIN) {
    throw new Error('REACT_APP_INGRESS_DOMAIN environment variable must be set');
}

const config = {
    API_URL: INGRESS_DOMAIN,
    WS_URL: INGRESS_DOMAIN
};

export default config; 