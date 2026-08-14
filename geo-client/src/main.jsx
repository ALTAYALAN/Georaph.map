import React from 'react'
import ReactDOM from 'react-dom/client'
import { PrimeReactProvider } from 'primereact/api'

// PrimeReact Theme, Core Styles and PrimeIcons
import 'primereact/resources/themes/lara-light-blue/theme.css'
import 'primereact/resources/primereact.min.css'
import 'primeicons/primeicons.css'

import App from './App.jsx'
import './App.css'

class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }

    componentDidCatch(error, errorInfo) {
        console.error("GeoMap Kritik Arayüz Hatası Yakalandı:", error, errorInfo);
    }

    render() {
        if (this.state.hasError) {
            return (
                <div style={{
                    padding: '40px',
                    background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
                    color: '#f8fafc',
                    height: '100vh',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontFamily: 'Inter, system-ui, sans-serif'
                }}>
                    <div style={{
                        background: 'rgba(30, 41, 59, 0.9)',
                        border: '1.5px solid #ef4444',
                        padding: '36px',
                        borderRadius: '16px',
                        maxWidth: '520px',
                        textAlign: 'center',
                        boxShadow: '0 20px 40px rgba(0,0,0,0.6)',
                        backdropFilter: 'blur(10px)'
                    }}>
                        <div style={{
                            width: '56px',
                            height: '56px',
                            borderRadius: '50%',
                            backgroundColor: 'rgba(239, 68, 68, 0.15)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            margin: '0 auto 20px auto',
                            border: '1px solid rgba(239, 68, 68, 0.4)'
                        }}>
                            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                                <line x1="12" y1="9" x2="12" y2="13" />
                                <line x1="12" y1="17" x2="12.01" y2="17" />
                            </svg>
                        </div>
                        <h2 style={{ color: '#f8fafc', fontSize: '20px', marginBottom: '12px', fontWeight: 600 }}>Uygulama Modülünde Hata Meydana Geldi</h2>
                        <p style={{ color: '#94a3b8', fontSize: '13.5px', lineHeight: '1.6', marginBottom: '24px' }}>
                            {this.state.error?.message || 'Arayüz yüklenirken beklenmeyen bir JavaScript hatası oluştu.'}
                        </p>
                        <button
                            onClick={() => { this.setState({ hasError: false }); window.location.reload(); }}
                            style={{
                                background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
                                color: '#ffffff',
                                border: 'none',
                                padding: '12px 24px',
                                borderRadius: '8px',
                                cursor: 'pointer',
                                fontWeight: '600',
                                fontSize: '14px',
                                boxShadow: '0 4px 12px rgba(37, 99, 235, 0.35)',
                                transition: 'all 0.2s ease'
                            }}
                        >
                            Uygulamayı Yeniden Başlat
                        </button>
                    </div>
                </div>
            );
        }
        return this.props.children;
    }
}

ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
        <ErrorBoundary>
            <PrimeReactProvider>
                <App />
            </PrimeReactProvider>
        </ErrorBoundary>
    </React.StrictMode>,
)