-- Inserindo Produtos do Excel
INSERT INTO public.products (user_id, name, category, price, cost_price, stock_quantity, brand, description)
VALUES 
('70815c35-c265-4962-ace1-bcc68ca595d4', 'iPhone XR 64GB VERMELHO', 'Celular', 1100.00, 895.00, 1, 'APPLE', 'SEMINOVO - Disponível para venda'),
('70815c35-c265-4962-ace1-bcc68ca595d4', 'iPhone 15 Pro Max 256GB TITÂNIO AZUL', 'Celular', 4699.99, 4650.00, 1, 'APPLE', 'SEMINOVO - Disponível para venda'),
('70815c35-c265-4962-ace1-bcc68ca595d4', 'iPhone 15 Pro Max 256GB TITÂNIO NATURAL', 'Celular', 4750.00, 4000.00, 1, 'APPLE', 'SEMINOVO - Disponível para venda'),
('70815c35-c265-4962-ace1-bcc68ca595d4', 'iPhone 15 Pro Max 256GB TITÂNIO PRETO', 'Celular', 4750.00, 4350.00, 1, 'APPLE', 'SEMINOVO - Disponível para venda'),
('70815c35-c265-4962-ace1-bcc68ca595d4', 'iPhone 15 128GB AZUL', 'Celular', 3125.00, 2750.00, 2, 'APPLE', 'SEMINOVO - Disponível para venda'),
('70815c35-c265-4962-ace1-bcc68ca595d4', 'iPhone 14 128GB BRANCO', 'Celular', 2700.00, 2350.00, 1, 'APPLE', 'SEMINOVO - Disponível para venda'),
('70815c35-c265-4962-ace1-bcc68ca595d4', 'iPhone 13 Pro Max 128GB BRANCO', 'Celular', 3200.00, 2850.00, 1, 'APPLE', 'SEMINOVO - Disponível para venda'),
('70815c35-c265-4962-ace1-bcc68ca595d4', 'iPhone 13 128GB BRANCO', 'Celular', 2500.00, 2640.00, 1, 'APPLE', 'SEMINOVO - Disponível para venda'),
('70815c35-c265-4962-ace1-bcc68ca595d4', 'iPhone 13 128GB PRETO NOVO', 'Celular', 2499.00, 2150.00, 1, 'APPLE', 'NOVO - Disponível para venda'),
('70815c35-c265-4962-ace1-bcc68ca595d4', 'iPhone 13 128GB PRETO SEMINOVO', 'Celular', 2399.00, 2050.00, 1, 'APPLE', 'SEMINOVO - Disponível para venda'),
('70815c35-c265-4962-ace1-bcc68ca595d4', 'iPhone 12 Pro Max 128GB AZUL', 'Celular', 1690.00, 1490.00, 1, 'APPLE', 'SEMINOVO - Disponível para venda'),
('70815c35-c265-4962-ace1-bcc68ca595d4', 'iPhone 11 Pro Max 64GB BRANCO', 'Celular', 1650.00, 900.00, 1, 'APPLE', 'SEMINOVO - Disponível para venda'),
('70815c35-c265-4962-ace1-bcc68ca595d4', 'iPhone 11 Pro 256GB GRAFITE', 'Celular', 1850.00, 1520.00, 1, 'APPLE', 'SEMINOVO - Disponível para venda'),
('70815c35-c265-4962-ace1-bcc68ca595d4', 'iPhone 11 128GB BRANCO', 'Celular', 1600.00, 1100.00, 1, 'APPLE', 'SEMINOVO - Disponível para venda'),
('70815c35-c265-4962-ace1-bcc68ca595d4', 'Kit Carregador Parede Turbo C Kevlar', 'Acessório', 110.00, 62.16, 2, 'GSHIELD', 'NOVO - Disponível para venda'),
('70815c35-c265-4962-ace1-bcc68ca595d4', 'Pelicula Dual Glass iPhone 15 PM', 'Acessório', 130.00, 23.47, 2, 'GSHIELD', 'NOVO - Disponível para venda'),
('70815c35-c265-4962-ace1-bcc68ca595d4', 'Pelicula Dual Glass iPhone 15', 'Acessório', 130.00, 23.47, 2, 'GSHIELD', 'NOVO - Disponível para venda'),
('70815c35-c265-4962-ace1-bcc68ca595d4', 'Carregador Turbo C 25W', 'Acessório', 177.00, 47.44, 2, 'GSHIELD', 'NOVO - Disponível para venda'),
('70815c35-c265-4962-ace1-bcc68ca595d4', 'Cabo Survivor Lightning C 1.5M', 'Acessório', 100.00, 23.72, 5, 'GSHIELD', 'NOVO - Disponível para venda'),
('70815c35-c265-4962-ace1-bcc68ca595d4', 'Cabo Survivor Lightning USB 1.5M', 'Acessório', 100.00, 17.18, 2, 'GSHIELD', 'NOVO - Disponível para venda'),
('70815c35-c265-4962-ace1-bcc68ca595d4', 'Carregador Veicular Flex', 'Acessório', 29.99, 8.17, 5, 'GSHIELD', 'NOVO - Disponível para venda'),
('70815c35-c265-4962-ace1-bcc68ca595d4', 'Fonte Original Apple', 'Acessório', 250.00, 200.00, 4, 'APPLE', 'NOVO - Disponível para venda'),
('70815c35-c265-4962-ace1-bcc68ca595d4', 'Fone Sem Fio Sumexr', 'Acessório', 89.99, 65.00, 2, 'SUMEXR', 'NOVO - Disponível para venda'),
('70815c35-c265-4962-ace1-bcc68ca595d4', 'Carregador Tipo C 2 em 1 Sumexr', 'Acessório', 70.00, 16.50, 8, 'SUMEXR', 'NOVO - Disponível para venda'),
('70815c35-c265-4962-ace1-bcc68ca595d4', 'Caneta Touch Capacitiva Pro Preta', 'Acessório', 197.00, 106.40, 1, 'GSHIELD', 'NOVO - Disponível para venda');

-- Inserindo Vendas do PDF
INSERT INTO public.sales_orders (user_id, total_amount, payment_method, status, created_at)
VALUES 
('70815c35-c265-4962-ace1-bcc68ca595d4', 2850.00, 'Pix', 'concluded', '2024-04-10 10:00:00'),
('70815c35-c265-4962-ace1-bcc68ca595d4', 197.00, 'Pix', 'concluded', '2024-04-11 14:30:00'),
('70815c35-c265-4962-ace1-bcc68ca595d4', 8700.00, 'Pix', 'concluded', '2024-04-12 16:15:00'),
('70815c35-c265-4962-ace1-bcc68ca595d4', 250.00, 'Pix', 'concluded', '2024-04-12 16:20:00'),
('70815c35-c265-4962-ace1-bcc68ca595d4', 1450.00, 'Pix', 'concluded', '2024-04-13 09:45:00');
