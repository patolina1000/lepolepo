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
            const response = await fetch('/api/auth-token', {
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
     * 2. CONSULTA DE SALDO
     * Endpoint: GET https://api.syncpayments.com.br/api/partner/v1/balance
     */
    async function getBalance() {
        console.log('💰 Consultando saldo...');

        try {
            const response = await fetch('/api/balance', {
                method: 'GET',
                headers: {
                    'Accept': 'application/json'
                }
            });

            console.log('📥 Resposta do saldo:', response.status, response.statusText);

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`HTTP ${response.status}: ${response.statusText} - ${errorText}`);
            }

            const data = await response.json();
            console.log('✅ Saldo consultado:', data);

            return data;

        } catch (error) {
            console.error('❌ Erro ao consultar saldo:', error);
            throw error;
        }
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

        // Validar CPF (11 dígitos)
        if (cpf.length !== 11 || !/^\d+$/.test(cpf)) {
            throw new Error('CPF deve ter exatamente 11 dígitos numéricos');
        }

        // Validar telefone (10-11 dígitos)
        if (phone.length < 10 || phone.length > 11 || !/^\d+$/.test(phone)) {
            throw new Error('Telefone deve ter 10 ou 11 dígitos numéricos');
        }

        // Validar email
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            throw new Error('Email inválido');
        }

        // Validar split se fornecido
        if (cashInData.split && Array.isArray(cashInData.split)) {
            for (const splitItem of cashInData.split) {
                if (!splitItem.percentage || !splitItem.user_id) {
                    throw new Error('Split deve conter percentage e user_id');
                }
                if (splitItem.percentage < 1 || splitItem.percentage > 100) {
                    throw new Error('Percentage deve estar entre 1 e 100');
                }
            }
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

            const response = await fetch('/api/cash-in', {
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

    /**
     * 4. CONSULTA DE STATUS DE TRANSAÇÃO
     * Endpoint: GET https://api.syncpayments.com.br/api/partner/v1/transaction/{identifier}
     */
    async function getTransactionStatus(identifier) {
        console.log('🔍 Consultando status da transação:', identifier);

        if (!identifier) {
            throw new Error('Identificador da transação é obrigatório');
        }

        try {
            const response = await fetch(`/api/transaction/${identifier}`, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json'
                }
            });

            console.log('📥 Resposta do status:', response.status, response.statusText);

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`HTTP ${response.status}: ${response.statusText} - ${errorText}`);
            }

            const data = await response.json();
            console.log('✅ Status da transação consultado:', data);

            return data;

        } catch (error) {
            console.error('❌ Erro ao consultar status da transação:', error);
            throw error;
        }
    }

    /**
     * 5. CASH-OUT (SAQUE VIA PIX)
     * Endpoint: POST https://api.syncpayments.com.br/api/partner/v1/cash-out
     */
    async function createCashOut(cashOutData) {
        console.log('💸 Criando cash-out (saque via Pix)...');

        // Validar dados obrigatórios
        if (!cashOutData.amount || cashOutData.amount <= 0) {
            throw new Error('Valor (amount) é obrigatório e deve ser maior que zero');
        }

        if (!cashOutData.pix_key_type || !cashOutData.pix_key) {
            throw new Error('pix_key_type e pix_key são obrigatórios');
        }

        if (!cashOutData.document || !cashOutData.document.type || !cashOutData.document.number) {
            throw new Error('document com type e number são obrigatórios');
        }

        // Validar pix_key_type
        const validPixKeyTypes = ['CPF', 'CNPJ', 'EMAIL', 'PHONE', 'EVP'];
        if (!validPixKeyTypes.includes(cashOutData.pix_key_type)) {
            throw new Error('pix_key_type deve ser: CPF, CNPJ, EMAIL, PHONE ou EVP');
        }

        // Validar document.type
        const validDocumentTypes = ['cpf', 'cnpj'];
        if (!validDocumentTypes.includes(cashOutData.document.type)) {
            throw new Error('document.type deve ser: cpf ou cnpj');
        }

        try {
            const requestData = {
                amount: cashOutData.amount,
                description: cashOutData.description || null,
                pix_key_type: cashOutData.pix_key_type,
                pix_key: cashOutData.pix_key,
                document: {
                    type: cashOutData.document.type,
                    number: cashOutData.document.number
                }
            };

            console.log('📤 Enviando dados do cash-out:', requestData);

            const response = await fetch('/api/cash-out', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify(requestData)
            });

            console.log('📥 Resposta do cash-out:', response.status, response.statusText);

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`HTTP ${response.status}: ${response.statusText} - ${errorText}`);
            }

            const data = await response.json();
            console.log('✅ Cash-out criado com sucesso:', data);

            return data;

        } catch (error) {
            console.error('❌ Erro ao criar cash-out:', error);
            throw error;
        }
    }

    /**
     * 6. CONSULTA DE DADOS DO PARCEIRO
     * Endpoint: GET https://api.syncpayments.com.br/api/partner/v1/profile
     */
    async function getProfile() {
        console.log('👤 Consultando dados do parceiro...');

        try {


            const response = await fetch('/api/profile', {
                method: 'GET',
                headers: {
                    'Accept': 'application/json'
                }
            });

            console.log('📥 Resposta do perfil:', response.status, response.statusText);

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`HTTP ${response.status}: ${response.statusText} - ${errorText}`);
            }

            const data = await response.json();
            console.log('✅ Dados do parceiro consultados:', data);

            return data;

        } catch (error) {
            console.error('❌ Erro ao consultar dados do parceiro:', error);
            throw error;
        }
    }

    /**
     * 7. GERENCIAMENTO DE WEBHOOKS
     */

    /**
     * Listar webhooks
     * Endpoint: GET https://api.syncpayments.com.br/api/partner/v1/webhooks
     */
    async function listWebhooks(search = null, per_page = null) {
        console.log('🔗 Listando webhooks...');

        try {


            let url = '/api/webhooks';
            const params = new URLSearchParams();
            
            if (search) params.append('search', search);
            if (per_page) params.append('per_page', per_page);
            
            if (params.toString()) {
                url += '?' + params.toString();
            }

            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json'
                }
            });

            console.log('📥 Resposta da listagem de webhooks:', response.status, response.statusText);

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`HTTP ${response.status}: ${response.statusText} - ${errorText}`);
            }

            const data = await response.json();
            console.log('✅ Webhooks listados:', data);

            return data;

        } catch (error) {
            console.error('❌ Erro ao listar webhooks:', error);
            throw error;
        }
    }

    /**
     * Criar webhook
     * Endpoint: POST https://api.syncpayments.com.br/api/partner/v1/webhooks
     */
    async function createWebhook(webhookData) {
        console.log('🔗 Criando webhook...');

        // Validar dados obrigatórios
        if (!webhookData.title || !webhookData.url || !webhookData.event) {
            throw new Error('title, url e event são obrigatórios');
        }

        // Validar event
        const validEvents = ['cashin', 'cashout', 'infraction'];
        if (!validEvents.includes(webhookData.event)) {
            throw new Error('event deve ser: cashin, cashout ou infraction');
        }

        try {
            const requestData = {
                title: webhookData.title,
                url: webhookData.url,
                event: webhookData.event,
                trigger_all_products: webhookData.trigger_all_products || false
            };

            console.log('📤 Enviando dados do webhook:', requestData);

            const response = await fetch('/api/webhooks', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify(requestData)
            });

            console.log('📥 Resposta da criação do webhook:', response.status, response.statusText);

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`HTTP ${response.status}: ${response.statusText} - ${errorText}`);
            }

            const data = await response.json();
            console.log('✅ Webhook criado com sucesso:', data);

            return data;

        } catch (error) {
            console.error('❌ Erro ao criar webhook:', error);
            throw error;
        }
    }

    /**
     * Atualizar webhook
     * Endpoint: PUT https://api.syncpayments.com.br/api/partner/v1/webhooks/{id}
     */
    async function updateWebhook(id, webhookData) {
        console.log('🔗 Atualizando webhook:', id);

        if (!id) {
            throw new Error('ID do webhook é obrigatório');
        }

        // Validar dados obrigatórios
        if (!webhookData.title || !webhookData.url || !webhookData.event) {
            throw new Error('title, url e event são obrigatórios');
        }

        // Validar event
        const validEvents = ['cashin', 'cashout', 'infraction'];
        if (!validEvents.includes(webhookData.event)) {
            throw new Error('event deve ser: cashin, cashout ou infraction');
        }

        try {
            const requestData = {
                title: webhookData.title,
                url: webhookData.url,
                event: webhookData.event,
                trigger_all_products: webhookData.trigger_all_products || false
            };

            console.log('📤 Enviando dados de atualização do webhook:', requestData);

            const response = await fetch(`/api/webhooks/${id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify(requestData)
            });

            console.log('📥 Resposta da atualização do webhook:', response.status, response.statusText);

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`HTTP ${response.status}: ${response.statusText} - ${errorText}`);
            }

            const data = await response.json();
            console.log('✅ Webhook atualizado com sucesso:', data);

            return data;

        } catch (error) {
            console.error('❌ Erro ao atualizar webhook:', error);
            throw error;
        }
    }

    /**
     * Deletar webhook
     * Endpoint: DELETE https://api.syncpayments.com.br/api/partner/v1/webhooks/{id}
     */
    async function deleteWebhook(id) {
        console.log('🔗 Deletando webhook:', id);

        if (!id) {
            throw new Error('ID do webhook é obrigatório');
        }

        try {


            const response = await fetch(`/api/webhooks/${id}`, {
                method: 'DELETE',
                headers: {
                    'Accept': 'application/json'
                }
            });

            console.log('📥 Resposta da exclusão do webhook:', response.status, response.statusText);

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`HTTP ${response.status}: ${response.statusText} - ${errorText}`);
            }

            const data = await response.json();
            console.log('✅ Webhook deletado com sucesso:', data);

            return data;

        } catch (error) {
            console.error('❌ Erro ao deletar webhook:', error);
            throw error;
        }
    }

    /**
     * Função utilitária para exibir logs formatados
     */
    function logInfo(message, data = null) {
        const timestamp = new Date().toLocaleString('pt-BR');
        console.log(`[${timestamp}] ℹ️ ${message}`);
        if (data) {
            console.log('📊 Dados:', data);
        }
    }

    /**
     * Função utilitária para exibir erros formatados
     */
    function logError(message, error = null) {
        const timestamp = new Date().toLocaleString('pt-BR');
        console.error(`[${timestamp}] ❌ ${message}`);
        if (error) {
            console.error('🔍 Detalhes do erro:', error);
        }
    }

    /**
     * Exemplo de uso das funções
     */
    async function exemploUso() {
        try {
            logInfo('🚀 Iniciando exemplo de uso da integração SyncPayments');

            // 1. Autenticação
            const token = await getAuthToken();
            logInfo('✅ Autenticação realizada', { token: token.substring(0, 20) + '...' });

            // 2. Consultar saldo
            const balance = await getBalance();
            logInfo('💰 Saldo consultado', balance);

            // 3. Consultar dados do parceiro
            const profile = await getProfile();
            logInfo('👤 Dados do parceiro', profile);

            // 4. Criar cash-in
            const cashInData = {
                amount: 50.00,
                description: 'Teste de integração',
                client: {
                    name: 'João Silva',
                    cpf: '12345678901',
                    email: 'joao@exemplo.com',
                    phone: '11987654321'
                },
                split: [
                    { percentage: 100, user_id: '708ddc0b-357d-4548-b158-615684caa616' }
                ]
            };

            const cashInResult = await createCashIn(cashInData);
            logInfo('💳 Cash-in criado', cashInResult);

            // 5. Consultar status da transação
            if (cashInResult.identifier) {
                const status = await getTransactionStatus(cashInResult.identifier);
                logInfo('🔍 Status da transação', status);
            }

            // 6. Criar cash-out (exemplo)
            const cashOutData = {
                amount: 25.00,
                description: 'Teste de saque',
                pix_key_type: 'CPF',
                pix_key: '12345678901',
                document: {
                    type: 'cpf',
                    number: '12345678901'
                }
            };

            const cashOutResult = await createCashOut(cashOutData);
            logInfo('💸 Cash-out criado', cashOutResult);

            // 7. Gerenciar webhooks
            const webhooks = await listWebhooks();
            logInfo('🔗 Webhooks existentes', webhooks);

            // 8. Criar webhook (exemplo)
            const webhookData = {
                title: 'Webhook de Teste',
                url: 'https://exemplo.com/webhook',
                event: 'cashin',
                trigger_all_products: true
            };

            const webhookResult = await createWebhook(webhookData);
            logInfo('🔗 Webhook criado', webhookResult);

        } catch (error) {
            logError('❌ Erro no exemplo de uso', error);
        }
    }

    // Expor funções para uso global
    window.SyncPayIntegration = {
        // Funções principais
        getAuthToken,
        getBalance,
        createCashIn,
        getTransactionStatus,
        createCashOut,
        getProfile,
        listWebhooks,
        createWebhook,
        updateWebhook,
        deleteWebhook,
        
        // Funções utilitárias
        isTokenValid,
        getValidToken,
        logInfo,
        logError,
        
        // Exemplo de uso
        exemploUso
    };

    // console.log('🔧 SyncPayIntegration carregado e disponível globalmente');
    // console.log('📚 Funções disponíveis:');
    // console.log('  - SyncPayIntegration.getAuthToken()');
    // console.log('  - SyncPayIntegration.getBalance()');
    // console.log('  - SyncPayIntegration.createCashIn(data)');
    // console.log('  - SyncPayIntegration.createCashOut(data)');
    // console.log('  - SyncPayIntegration.getTransactionStatus(identifier)');
    // console.log('  - SyncPayIntegration.getProfile()');
    // console.log('  - SyncPayIntegration.listWebhooks(search, per_page)');
    // console.log('  - SyncPayIntegration.createWebhook(data)');
    // console.log('  - SyncPayIntegration.updateWebhook(id, data)');
    // console.log('  - SyncPayIntegration.deleteWebhook(id)');
    // console.log('  - SyncPayIntegration.exemploUso()');    

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

        hideLoading: function() {
            if (typeof swal !== 'undefined' && typeof swal.close === 'function') {
                try {
                    swal.close();
                } catch (error) {
                    console.warn('Erro ao fechar SweetAlert:', error);
                }
            }

            const existingLoading = document.getElementById('nativeLoading');
            if (existingLoading) {
                existingLoading.remove();
            }
        },

        showPixModal: function(data) {
            // Usar o modal de pagamento personalizado
            console.log('💳 PIX gerado:', data);

            this.hideLoading();

            try {
                if (window.showPaymentModal && typeof window.showPaymentModal === 'function') {
                    // Usar o modal personalizado
                    window.showPaymentModal({
                        pix_qr_code: data.pix_code,
                        pix_copy_paste: data.pix_code,
                        amount: data.amount || 0,
                        identifier: data.id,
                        status: 'pending'
                    });
                } else if (window.showPixPopup && typeof window.showPixPopup === 'function') {
                    // Usar popup alternativo
                    window.showPixPopup({
                        pix_code: data.pix_code,
                        amount: data.amount || 0,
                        id: data.id
                    });
                } else {
                    // Fallback para alert simples
                    alert('PIX gerado com sucesso! Código: ' + (data.pix_code ? data.pix_code.substring(0, 50) + '...' : 'Não disponível'));
                }
            } catch (error) {
                console.error('Erro ao mostrar modal PIX:', error);
                // Fallback final
                alert('PIX gerado! Código: ' + (data.pix_code ? data.pix_code.substring(0, 50) + '...' : 'Não disponível'));
            }
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

// Adicionar planos de exemplo se não existirem
if (!window.SYNCPAY_CONFIG.plans) {
    window.SYNCPAY_CONFIG.plans = {
        monthly: {
            price: 19.90,
            description: 'Assinatura Mensal - 1 mês'
        },
        quarterly: {
            price: 59.70,
            description: 'Assinatura Trimestral - 3 meses'
        },
        semestrial: {
            price: 119.40,
            description: 'Assinatura Semestral - 6 meses'
        }
    };
}
