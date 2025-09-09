# Fluxo de Funil Implementado

## Estrutura do Fluxo

Cada página "up" agora tem seu próprio fluxo específico conforme solicitado:

### Fluxo UP1
```
up1.html → back1.html → up2.html
```

### Fluxo UP2  
```
up2.html → back2.html → up3.html
```

### Fluxo UP3
```
up3.html → back3.html → compra-aprovada/index.html
```

## Alterações Implementadas

### 1. Botões de Recusa
- **up1.html**: Botão "RECUSAR ESSA OFERTA" → redireciona para `back1.html`
- **up2.html**: Botão "Não, obrigado. Talvez mais tarde." → redireciona para `back2.html`  
- **up3.html**: Botão "Não, obrigado. Talvez mais tarde." → redireciona para `back3.html`
- **back1.html**: Botão "Não, quero perder essa chance única..." → redireciona para `compra-aprovada/index.html`
- **back2.html**: Botão "Não, prefiro ficar na punheta mesmo..." → redireciona para `compra-aprovada/index.html`
- **back3.html**: Botão "Não, vou continuar sozinho e triste..." → redireciona para `compra-aprovada/index.html`

### 2. Botões de Compra
Os botões de compra agora seguem o fluxo sequencial do funil:

- **up1.html**: `gerarPixPlano('upsell1_videos', 'Vídeos Personalizados', 17.00, 'up2.html')`
- **back1.html**: `gerarPixPlano('back1_videos', 'Vídeos Personalizados - ÚLTIMA CHANCE', 19.90, 'up2.html')`
- **up2.html**: `gerarPixPlano('upsell2_chat', 'Chat Exclusivo', 19.90, 'up3.html')`
- **back2.html**: `gerarPixPlano('back2_videos', 'Vídeos Personalizados - SUPER DESCONTO', 9.90, 'up3.html')`
- **up3.html**: `gerarPixPlano('upsell3_whatsapp', 'WhatsApp Exclusivo', 15.00, '../compra-aprovada/index.html')`
- **back3.html**: `gerarPixPlano('back3_videos', 'Vídeos Personalizados - PREÇO FINAL', 4.90, '../compra-aprovada/index.html')`

### 3. Função de Pagamento Atualizada
A função `gerarPixPlano` foi atualizada em todas as páginas para aceitar um parâmetro adicional `redirectUrl`:

```javascript
async function gerarPixPlano(planoId, planoNome, planoValor, redirectUrl = null)
```

### 4. Redirecionamento Automático
Após o pagamento bem-sucedido, o sistema:
1. Tenta usar callbacks `onSuccess` nos modais de pagamento
2. Se não houver modal, redireciona automaticamente após 3 segundos
3. Redireciona para `../compra-aprovada/index.html` em todos os casos

## Como Funciona

1. **Usuário acessa up1.html**: Vê oferta de vídeos personalizados por R$ 17,00
2. **Se recusar**: Vai para back1.html com oferta de última chance por R$ 19,90
3. **Se comprar em qualquer etapa**: Vai para compra-aprovada/index.html
4. **Mesmo fluxo para up2 e up3**: Cada um com seu respectivo back e preços

## Páginas de Back

- **back1.html**: Oferta de última chance (R$ 19,90) → se recusar vai para back2.html
- **back2.html**: Oferta de super desconto (R$ 9,90) → se recusar vai para back3.html  
- **back3.html**: Oferta de preço final (R$ 4,90) → se recusar volta para index.html

## Página de Compra Aprovada

Todos os fluxos terminam na mesma página: `compra-aprovada/index.html`
- Mostra confirmação de compra
- Link para grupo VIP do Telegram
- Aviso sobre direitos autorais
