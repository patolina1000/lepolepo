/**
 * Universal Payment Integration - Integração universal que funciona com qualquer gateway
 * Detecta automaticamente o gateway selecionado e usa a API correspondente
 */

(function() {
    'use strict';

    /**
     * Classe para integração universal de pagamentos
     */
    class UniversalPaymentIntegration {
        constructor() {
            this.currentGateway = 'syncpay'; // padrão
            this.init();
        }

        async init() {
            await this.loadCurrentGateway();
        }

        async loadCurrentGateway() {
            try {
                const response = await fetch('../api/gateways/current');
                const data = await response.json();
                if (data.success) {
                    this.currentGateway = data.gateway;
                    console.log(`🎯 Gateway atual carregado: ${this.currentGateway}`);
                }
            } catch (error) {
                console.error('Erro ao carregar gateway atual:', error);
                // Manter padrão syncpay em caso de erro
            }
        }

        getCurrentGateway() {
            return this.currentGateway;
        }

        async createPixTransaction(amount, description, clientData = null) {
            try {
                console.log(`💰 Criando transação PIX via ${this.currentGateway.toUpperCase()}...`);
                
                // Dados padrão do cliente se não fornecidos
                const defaultClientData = {
                    name: 'Cliente',
                    cpf: '12345678901',
                    email: 'cliente@exemplo.com',
                    phone: '11999999999'
                };

                const finalClientData = { ...defaultClientData, ...clientData };

                // Preparar dados para o endpoint unificado
                const paymentData = {
                    amount: parseFloat(amount),
                    description: description,
                    customer_name: finalClientData.name,
                    customer_email: finalClientData.email,
                    customer_document: finalClientData.cpf,
                    customer_phone: finalClientData.phone
                };

                console.log('📤 Enviando dados do pagamento:', paymentData);

                // Usar o endpoint unificado que já detecta o gateway
                const response = await fetch('../api/payments/pix/create', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'application/json'
                    },
                    body: JSON.stringify(paymentData)
                });

                console.log('📥 Resposta recebida:', response.status, response.statusText);

                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(`HTTP ${response.status}: ${errorData.message || response.statusText}`);
                }

                const data = await response.json();
                console.log(`✅ Transação PIX criada via ${data.gateway.toUpperCase()}:`, data);

                // Retornar dados padronizados independente do gateway
                return {
                    id: data.data.id || data.data.identifier || data.data.payment_id,
                    pix_code: data.data.pix_code || data.data.qr_code,
                    message: data.message,
                    gateway: data.gateway,
                    amount: amount,
                    description: description
                };

            } catch (error) {
                console.error(`❌ Erro ao criar transação PIX via ${this.currentGateway}:`, error);
                throw error;
            }
        }

        async getPaymentStatus(paymentId) {
            try {
                console.log(`🔍 Consultando status via ${this.currentGateway.toUpperCase()}...`);
                
                const response = await fetch(`../api/payments/${paymentId}/status`);
                const data = await response.json();
                
                if (data.success) {
                    return data.data;
                } else {
                    throw new Error(data.message || 'Erro ao consultar status');
                }
            } catch (error) {
                console.error('Erro ao consultar status:', error);
                throw error;
            }
        }

        showLoading() {
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
        }
        
        showNativeLoading() {
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
        }

        showPixModal(data) {
            // Usar o modal de pagamento personalizado
            console.log(`💳 PIX gerado via ${data.gateway?.toUpperCase() || this.currentGateway.toUpperCase()}:`, data);
            
            try {
                if (window.showPaymentModal && typeof window.showPaymentModal === 'function') {
                    // Usar o modal personalizado
                    window.showPaymentModal({
                        pix_qr_code: data.pix_code,
                        pix_copy_paste: data.pix_code,
                        amount: data.amount || 0,
                        identifier: data.id,
                        status: 'pending',
                        gateway: data.gateway || this.currentGateway
                    });
                } else if (window.showPixPopup && typeof window.showPixPopup === 'function') {
                    // Usar popup alternativo
                    window.showPixPopup({
                        pix_code: data.pix_code,
                        amount: data.amount || 0,
                        id: data.id,
                        gateway: data.gateway || this.currentGateway
                    });
                } else {
                    // Fallback para alert simples
                    alert(`PIX gerado com sucesso via ${(data.gateway || this.currentGateway).toUpperCase()}! Código: ${data.pix_code ? data.pix_code.substring(0, 50) + '...' : 'Não disponível'}`);
                }
            } catch (error) {
                console.error('Erro ao mostrar modal PIX:', error);
                // Fallback final
                alert(`PIX gerado via ${(data.gateway || this.currentGateway).toUpperCase()}! Código: ${data.pix_code ? data.pix_code.substring(0, 50) + '...' : 'Não disponível'}`);
            }
        }

        // Método para atualizar o gateway atual (chamado quando o usuário muda a seleção)
        updateCurrentGateway(gateway) {
            this.currentGateway = gateway;
            console.log(`🔄 Gateway atualizado para: ${gateway}`);
        }
    }

    // Instanciar a integração universal
    const universalPayment = new UniversalPaymentIntegration();

    // Expor para uso global - substituindo o window.syncPay existente
    window.universalPayment = universalPayment;

    // Manter compatibilidade com código existente criando um bridge
    window.syncPay = {
        showLoading: () => universalPayment.showLoading(),
        createPixTransaction: (amount, description, clientData) => universalPayment.createPixTransaction(amount, description, clientData),
        showPixModal: (data) => universalPayment.showPixModal(data)
    };

    console.log('🔧 Universal Payment Integration carregado!');
    console.log('📚 Funcionalidades:');
    console.log('  - Detecção automática do gateway selecionado');
    console.log('  - Compatibilidade com SyncPay e PushinPay');
    console.log('  - Bridge para código existente (window.syncPay)');

})();
