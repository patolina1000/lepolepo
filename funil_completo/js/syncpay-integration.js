/**
 * SyncPay Integration - Cliente completo para API SyncPayments
 * Implementa autenticação, consulta de saldo, cash-in e consulta de status
 */

(function() {
    'use strict';

    // Configuração da API
    const API_CONFIG = {
        baseUrl: 'https://api.syncpayments.com.br/api/partner/v1',
        authEndpoint: '/auth-token',
        balanceEndpoint: '/balance',
        cashInEndpoint: '/cash-in',
        transactionEndpoint: '/transaction'
    };

    // Armazenamento do token em memória
    let authToken = null;
    let tokenExpiry = null;

    /**
     * 1. AUTENTICAÇÃO
     * Endpoint: POST /api/auth-token (via proxy backend)
     */
    async function getAuthToken() {
        console.log('🔐 Iniciando autenticação SyncPayments...');

        // Verificar se já existe um token válido
        if (isTokenValid()) {
            console.log('✅ Token válido encontrado em memória');
            return authToken;
        }

        // Validar configuração
        if (!window.SYNCPAY_CONFIG) {
            throw new Error('Configuração SYNCPAY_CONFIG não encontrada');
        }

        const { client_id, client_secret } = window.SYNCPAY_CONFIG;

        if (!client_id || !client_secret) {
            throw new Error('client_id ou client_secret não configurados');
        }

        // Preparar dados da requisição
        const authData = {
            client_id: client_id,
            client_secret: client_secret,
            '01K1259MAXE0TNRXV2C2WQN2MV': 'auth_request_' + Date.now()
        };

        try {
            console.log('📤 Enviando requisição de autenticação via proxy...');
            
            // Usar o proxy backend para evitar CORS
            const response = await fetch('../api/auth-token', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify(authData)
            });

            console.log('📥 Resposta recebida:', response.status, response.statusText);

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(`HTTP ${response.status}: ${errorData.message || response.statusText}`);
            }

            const data = await response.json();
            console.log('✅ Autenticação bem-sucedida:', data);

            // Armazenar token em memória
            if (data.access_token) {
                authToken = data.access_token;
                tokenExpiry = new Date(data.expires_at);
                
                console.log('💾 Token armazenado em memória');
                console.log('⏰ Token expira em:', tokenExpiry.toLocaleString());
                
                return authToken;
            } else {
                throw new Error('Token de acesso não encontrado na resposta');
            }

        } catch (error) {
            console.error('❌ Erro na autenticação:', error);
            throw error;
        }
    }

    /**
     * Verificar se o token atual é válido
     */
    function isTokenValid() {
        if (!authToken || !tokenExpiry) {
            return false;
        }
        
        // Verificar se o token não expirou (com margem de 5 minutos)
        const now = new Date();
        const margin = 5 * 60 * 1000; // 5 minutos em ms
        
        return now < new Date(tokenExpiry.getTime() - margin);
    }

    /**
     * Obter token válido (renova automaticamente se necessário)
     */
    async function getValidToken() {
        if (!isTokenValid()) {
            console.log('🔄 Token expirado ou inexistente, renovando...');
            await getAuthToken();
        }
        return authToken;
    }

    /**
     * 3. CASH-IN (DEPÓSITO VIA PIX)
     * Endpoint: POST https://api.syncpayments.com.br/api/partner/v1/cash-in
     */
    async function createCashIn(cashInData) {
        console.log('💳 Criando cash-in (depósito via Pix)...');

        // Validar dados obrigatórios
        if (!cashInData.amount || cashInData.amount <= 0) {
            throw new Error('Valor (amount) é obrigatório e deve ser maior que zero');
        }

        if (!cashInData.client) {
            throw new Error('Dados do cliente são obrigatórios');
        }

        const { name, cpf, email, phone } = cashInData.client;
        if (!name || !cpf || !email || !phone) {
            throw new Error('Todos os dados do cliente são obrigatórios: name, cpf, email, phone');
        }

        try {
            const requestData = {
                amount: cashInData.amount,
                description: cashInData.description || null,
                client: {
                    name: name,
                    cpf: cpf,
                    email: email,
                    phone: phone
                }
            };

            // Adicionar split se fornecido
            if (cashInData.split) {
                requestData.split = cashInData.split;
            }

            console.log('📤 Enviando dados do cash-in:', requestData);

            const response = await fetch('../api/cash-in', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify(requestData)
            });

            console.log('📥 Resposta do cash-in:', response.status, response.statusText);

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`HTTP ${response.status}: ${response.statusText} - ${errorText}`);
            }

            const data = await response.json();
            console.log('✅ Cash-in criado com sucesso:', data);

            return data;

        } catch (error) {
            console.error('❌ Erro ao criar cash-in:', error);
            throw error;
        }
    }

    // Expor funções para uso global
    window.SyncPayIntegration = {
        getAuthToken,
        createCashIn,
        isTokenValid,
        getValidToken
    };

    // Criar bridge para compatibilidade com botões existentes
    window.syncPay = {
        showLoading: function() {
            console.log('🔄 Carregando...');
            
            // Criar loading nativo se SweetAlert não estiver disponível
            if (typeof swal !== 'undefined') {
                try {
                    swal({
                        title: 'Processando pagamento...',
                        icon: 'info',
                        buttons: false,
                        closeOnClickOutside: false,
                        closeOnEsc: false
                    });
                } catch (error) {
                    console.warn('Erro ao mostrar loading SweetAlert:', error);
                    this.showNativeLoading();
                }
            } else {
                this.showNativeLoading();
            }
        },
        
        showNativeLoading: function() {
            // Remover loading anterior se existir
            const existingLoading = document.getElementById('nativeLoading');
            if (existingLoading) {
                existingLoading.remove();
            }
            
            // Criar loading nativo
            const loading = document.createElement('div');
            loading.id = 'nativeLoading';
            loading.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0,0,0,0.7);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 9999;
                color: white;
                font-size: 18px;
                font-weight: 500;
            `;
            loading.innerHTML = `
                <div style="text-align: center;">
                    <div style="margin-bottom: 15px;">
                        <div style="border: 4px solid #f3f3f3; border-top: 4px solid #F58170; border-radius: 50%; width: 40px; height: 40px; animation: spin 1s linear infinite; margin: 0 auto;"></div>
                    </div>
                    <div>Processando pagamento...</div>
                </div>
                <style>
                    @keyframes spin {
                        0% { transform: rotate(0deg); }
                        100% { transform: rotate(360deg); }
                    }
                </style>
            `;
            document.body.appendChild(loading);
        },
        
        createPixTransaction: async function(amount, description, clientData) {
            try {
                const cashInData = {
                    amount: parseFloat(amount),
                    description: description,
                    client: {
                        name: clientData?.name || 'Cliente',
                        cpf: clientData?.cpf || '12345678901',
                        email: clientData?.email || 'cliente@exemplo.com',
                        phone: clientData?.phone || '11999999999'
                    }
                };
                
                const result = await createCashIn(cashInData);
                return {
                    id: result.identifier,
                    pix_code: result.pix_code,
                    message: result.message
                };
            } catch (error) {
                console.error('Erro ao criar transação PIX:', error);
                throw error;
            }
        }
    };

})();
