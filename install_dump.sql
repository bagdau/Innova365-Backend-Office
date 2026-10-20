--
-- PostgreSQL database dump
--

\restrict KmAvMbfCo2ojVpwK1y3bmbUumWcaqb3SuDbsz3TJf1L4aTRW4xEpYlRNSYrUJFY

-- Dumped from database version 16.15
-- Dumped by pg_dump version 16.15

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

ALTER TABLE IF EXISTS ONLY public."Usuario" DROP CONSTRAINT IF EXISTS "Usuario_restauranteId_fkey";
ALTER TABLE IF EXISTS ONLY public."TrabajoImpresion" DROP CONSTRAINT IF EXISTS "TrabajoImpresion_impresoraId_fkey";
ALTER TABLE IF EXISTS ONLY public."Recepcion" DROP CONSTRAINT IF EXISTS "Recepcion_compraId_fkey";
ALTER TABLE IF EXISTS ONLY public."RecepcionItem" DROP CONSTRAINT IF EXISTS "RecepcionItem_recepcionId_fkey";
ALTER TABLE IF EXISTS ONLY public."Proveedor" DROP CONSTRAINT IF EXISTS "Proveedor_restauranteId_fkey";
ALTER TABLE IF EXISTS ONLY public."Producto" DROP CONSTRAINT IF EXISTS "Producto_restauranteId_fkey";
ALTER TABLE IF EXISTS ONLY public."Producto" DROP CONSTRAINT IF EXISTS "Producto_categoriaId_fkey";
ALTER TABLE IF EXISTS ONLY public."Pedido" DROP CONSTRAINT IF EXISTS "Pedido_restauranteId_fkey";
ALTER TABLE IF EXISTS ONLY public."Pedido" DROP CONSTRAINT IF EXISTS "Pedido_meseroId_fkey";
ALTER TABLE IF EXISTS ONLY public."Pedido" DROP CONSTRAINT IF EXISTS "Pedido_mesaId_fkey";
ALTER TABLE IF EXISTS ONLY public."MovimientoInventario" DROP CONSTRAINT IF EXISTS "MovimientoInventario_insumoId_fkey";
ALTER TABLE IF EXISTS ONLY public."Mesa" DROP CONSTRAINT IF EXISTS "Mesa_restauranteId_fkey";
ALTER TABLE IF EXISTS ONLY public."ItemPedido" DROP CONSTRAINT IF EXISTS "ItemPedido_productoId_fkey";
ALTER TABLE IF EXISTS ONLY public."ItemPedido" DROP CONSTRAINT IF EXISTS "ItemPedido_pedidoId_fkey";
ALTER TABLE IF EXISTS ONLY public."Insumo" DROP CONSTRAINT IF EXISTS "Insumo_restauranteId_fkey";
ALTER TABLE IF EXISTS ONLY public."Impresora" DROP CONSTRAINT IF EXISTS "Impresora_restauranteId_fkey";
ALTER TABLE IF EXISTS ONLY public."Compra" DROP CONSTRAINT IF EXISTS "Compra_restauranteId_fkey";
ALTER TABLE IF EXISTS ONLY public."Compra" DROP CONSTRAINT IF EXISTS "Compra_proveedorId_fkey";
ALTER TABLE IF EXISTS ONLY public."CompraItem" DROP CONSTRAINT IF EXISTS "CompraItem_insumoId_fkey";
ALTER TABLE IF EXISTS ONLY public."CompraItem" DROP CONSTRAINT IF EXISTS "CompraItem_compraId_fkey";
ALTER TABLE IF EXISTS ONLY public."Categoria" DROP CONSTRAINT IF EXISTS "Categoria_restauranteId_fkey";
DROP INDEX IF EXISTS public."Usuario_restauranteId_idx";
DROP INDEX IF EXISTS public."Usuario_email_key";
DROP INDEX IF EXISTS public."TrabajoImpresion_restauranteId_creadoEn_idx";
DROP INDEX IF EXISTS public."RegistroActividad_usuarioId_creadoEn_idx";
DROP INDEX IF EXISTS public."RegistroActividad_restauranteId_creadoEn_idx";
DROP INDEX IF EXISTS public."Recepcion_restauranteId_creadoEn_idx";
DROP INDEX IF EXISTS public."Recepcion_compraId_idx";
DROP INDEX IF EXISTS public."RecepcionItem_recepcionId_idx";
DROP INDEX IF EXISTS public."Proveedor_restauranteId_idx";
DROP INDEX IF EXISTS public."Producto_restauranteId_idx";
DROP INDEX IF EXISTS public."Producto_categoriaId_idx";
DROP INDEX IF EXISTS public."Pedido_restauranteId_estado_idx";
DROP INDEX IF EXISTS public."Pedido_restauranteId_creadoEn_idx";
DROP INDEX IF EXISTS public."Pedido_meseroId_idx";
DROP INDEX IF EXISTS public."Pedido_mesaId_idx";
DROP INDEX IF EXISTS public."OperacionIdem_creadoEn_idx";
DROP INDEX IF EXISTS public."MovimientoInventario_restauranteId_creadoEn_idx";
DROP INDEX IF EXISTS public."MovimientoInventario_insumoId_creadoEn_idx";
DROP INDEX IF EXISTS public."MovimientoInventario_compraId_idx";
DROP INDEX IF EXISTS public."Mesa_restauranteId_idx";
DROP INDEX IF EXISTS public."ItemPedido_productoId_idx";
DROP INDEX IF EXISTS public."ItemPedido_pedidoId_idx";
DROP INDEX IF EXISTS public."Insumo_restauranteId_idx";
DROP INDEX IF EXISTS public."Impresora_restauranteId_idx";
DROP INDEX IF EXISTS public."Compra_restauranteId_estado_idx";
DROP INDEX IF EXISTS public."Compra_restauranteId_creadoEn_idx";
DROP INDEX IF EXISTS public."Compra_proveedorId_idx";
DROP INDEX IF EXISTS public."CompraItem_insumoId_idx";
DROP INDEX IF EXISTS public."CompraItem_compraId_idx";
DROP INDEX IF EXISTS public."Categoria_restauranteId_idx";
ALTER TABLE IF EXISTS ONLY public._prisma_migrations DROP CONSTRAINT IF EXISTS _prisma_migrations_pkey;
ALTER TABLE IF EXISTS ONLY public."Usuario" DROP CONSTRAINT IF EXISTS "Usuario_pkey";
ALTER TABLE IF EXISTS ONLY public."TrabajoImpresion" DROP CONSTRAINT IF EXISTS "TrabajoImpresion_pkey";
ALTER TABLE IF EXISTS ONLY public."Restaurante" DROP CONSTRAINT IF EXISTS "Restaurante_pkey";
ALTER TABLE IF EXISTS ONLY public."RegistroActividad" DROP CONSTRAINT IF EXISTS "RegistroActividad_pkey";
ALTER TABLE IF EXISTS ONLY public."Recepcion" DROP CONSTRAINT IF EXISTS "Recepcion_pkey";
ALTER TABLE IF EXISTS ONLY public."RecepcionItem" DROP CONSTRAINT IF EXISTS "RecepcionItem_pkey";
ALTER TABLE IF EXISTS ONLY public."Proveedor" DROP CONSTRAINT IF EXISTS "Proveedor_pkey";
ALTER TABLE IF EXISTS ONLY public."Producto" DROP CONSTRAINT IF EXISTS "Producto_pkey";
ALTER TABLE IF EXISTS ONLY public."Pedido" DROP CONSTRAINT IF EXISTS "Pedido_pkey";
ALTER TABLE IF EXISTS ONLY public."OperacionIdem" DROP CONSTRAINT IF EXISTS "OperacionIdem_pkey";
ALTER TABLE IF EXISTS ONLY public."MovimientoInventario" DROP CONSTRAINT IF EXISTS "MovimientoInventario_pkey";
ALTER TABLE IF EXISTS ONLY public."Mesa" DROP CONSTRAINT IF EXISTS "Mesa_pkey";
ALTER TABLE IF EXISTS ONLY public."ItemPedido" DROP CONSTRAINT IF EXISTS "ItemPedido_pkey";
ALTER TABLE IF EXISTS ONLY public."Insumo" DROP CONSTRAINT IF EXISTS "Insumo_pkey";
ALTER TABLE IF EXISTS ONLY public."Impresora" DROP CONSTRAINT IF EXISTS "Impresora_pkey";
ALTER TABLE IF EXISTS ONLY public."Compra" DROP CONSTRAINT IF EXISTS "Compra_pkey";
ALTER TABLE IF EXISTS ONLY public."CompraItem" DROP CONSTRAINT IF EXISTS "CompraItem_pkey";
ALTER TABLE IF EXISTS ONLY public."Categoria" DROP CONSTRAINT IF EXISTS "Categoria_pkey";
ALTER TABLE IF EXISTS public."Pedido" ALTER COLUMN numero DROP DEFAULT;
ALTER TABLE IF EXISTS public."Compra" ALTER COLUMN numero DROP DEFAULT;
DROP TABLE IF EXISTS public._prisma_migrations;
DROP TABLE IF EXISTS public."Usuario";
DROP TABLE IF EXISTS public."TrabajoImpresion";
DROP TABLE IF EXISTS public."Restaurante";
DROP TABLE IF EXISTS public."RegistroActividad";
DROP TABLE IF EXISTS public."RecepcionItem";
DROP TABLE IF EXISTS public."Recepcion";
DROP TABLE IF EXISTS public."Proveedor";
DROP TABLE IF EXISTS public."Producto";
DROP SEQUENCE IF EXISTS public."Pedido_numero_seq";
DROP TABLE IF EXISTS public."Pedido";
DROP TABLE IF EXISTS public."OperacionIdem";
DROP TABLE IF EXISTS public."MovimientoInventario";
DROP TABLE IF EXISTS public."Mesa";
DROP TABLE IF EXISTS public."ItemPedido";
DROP TABLE IF EXISTS public."Insumo";
DROP TABLE IF EXISTS public."Impresora";
DROP SEQUENCE IF EXISTS public."Compra_numero_seq";
DROP TABLE IF EXISTS public."CompraItem";
DROP TABLE IF EXISTS public."Compra";
DROP TABLE IF EXISTS public."Categoria";
DROP TYPE IF EXISTS public."TipoPedido";
DROP TYPE IF EXISTS public."TipoMovimiento";
DROP TYPE IF EXISTS public."TipoImpresora";
DROP TYPE IF EXISTS public."Rol";
DROP TYPE IF EXISTS public."EstadoPedido";
DROP TYPE IF EXISTS public."EstadoMesa";
DROP TYPE IF EXISTS public."EstadoCompra";
--
-- Name: EstadoCompra; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."EstadoCompra" AS ENUM (
    'PEDIDA',
    'PARCIAL',
    'RECIBIDA',
    'CANCELADA'
);


--
-- Name: EstadoMesa; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."EstadoMesa" AS ENUM (
    'LIBRE',
    'OCUPADA',
    'EN_ESPERA'
);


--
-- Name: EstadoPedido; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."EstadoPedido" AS ENUM (
    'PENDIENTE',
    'EN_COCINA',
    'EN_PREPARACION',
    'LISTO',
    'ENTREGADO',
    'PAGADO',
    'CANCELADO'
);


--
-- Name: Rol; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."Rol" AS ENUM (
    'ADMIN',
    'MESERO',
    'COCINERO',
    'CAJERO',
    'SUPERADMIN'
);


--
-- Name: TipoImpresora; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."TipoImpresora" AS ENUM (
    'RED',
    'AGENTE',
    'NAVEGADOR'
);


--
-- Name: TipoMovimiento; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."TipoMovimiento" AS ENUM (
    'INICIAL',
    'COMPRA',
    'AJUSTE',
    'MERMA',
    'REVISION',
    'CONSUMO'
);


--
-- Name: TipoPedido; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."TipoPedido" AS ENUM (
    'EN_MESA',
    'PARA_LLEVAR'
);


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: Categoria; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Categoria" (
    id text NOT NULL,
    nombre text NOT NULL,
    "restauranteId" text NOT NULL
);


--
-- Name: Compra; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Compra" (
    id text NOT NULL,
    numero integer NOT NULL,
    estado public."EstadoCompra" DEFAULT 'PEDIDA'::public."EstadoCompra" NOT NULL,
    "proveedorId" text NOT NULL,
    "restauranteId" text NOT NULL,
    "usuarioId" text,
    "fechaEsperada" timestamp(3) without time zone,
    notas text,
    total numeric(14,2) DEFAULT 0 NOT NULL,
    "creadoEn" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "actualizadoEn" timestamp(3) without time zone NOT NULL
);


--
-- Name: CompraItem; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."CompraItem" (
    id text NOT NULL,
    "compraId" text NOT NULL,
    "insumoId" text NOT NULL,
    cantidad numeric(14,3) NOT NULL,
    "costoUnitario" numeric(14,2) NOT NULL,
    "cantidadRecibida" numeric(14,3) DEFAULT 0 NOT NULL
);


--
-- Name: Compra_numero_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."Compra_numero_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: Compra_numero_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."Compra_numero_seq" OWNED BY public."Compra".numero;


--
-- Name: Impresora; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Impresora" (
    id text NOT NULL,
    "restauranteId" text NOT NULL,
    nombre text NOT NULL,
    tipo public."TipoImpresora" NOT NULL,
    host text,
    puerto integer DEFAULT 9100,
    "nombreSistema" text,
    token text,
    ancho integer DEFAULT 80 NOT NULL,
    codepage text DEFAULT 'cp866'::text NOT NULL,
    usos text[],
    corte boolean DEFAULT true NOT NULL,
    cajon boolean DEFAULT false NOT NULL,
    copias integer DEFAULT 1 NOT NULL,
    activa boolean DEFAULT true NOT NULL,
    "creadoEn" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    auto boolean DEFAULT false NOT NULL
);


--
-- Name: Insumo; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Insumo" (
    id text NOT NULL,
    nombre text NOT NULL,
    categoria text,
    unidad text NOT NULL,
    "stockActual" numeric(65,30) NOT NULL,
    "stockMinimo" numeric(65,30) NOT NULL,
    proveedor text,
    "restauranteId" text NOT NULL,
    "creadoEn" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "actualizadoEn" timestamp(3) without time zone NOT NULL,
    "costoUnitario" numeric(14,2)
);


--
-- Name: ItemPedido; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."ItemPedido" (
    id text NOT NULL,
    "pedidoId" text NOT NULL,
    "productoId" text NOT NULL,
    cantidad integer NOT NULL,
    precio numeric(65,30) NOT NULL,
    subtotal numeric(65,30) NOT NULL,
    servido boolean DEFAULT false NOT NULL
);


--
-- Name: Mesa; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Mesa" (
    id text NOT NULL,
    numero integer NOT NULL,
    capacidad integer DEFAULT 4 NOT NULL,
    estado public."EstadoMesa" DEFAULT 'LIBRE'::public."EstadoMesa" NOT NULL,
    "restauranteId" text NOT NULL
);


--
-- Name: MovimientoInventario; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."MovimientoInventario" (
    id text NOT NULL,
    "restauranteId" text NOT NULL,
    "insumoId" text NOT NULL,
    tipo public."TipoMovimiento" NOT NULL,
    cantidad numeric(14,3) NOT NULL,
    saldo numeric(14,3) NOT NULL,
    "costoUnitario" numeric(14,2),
    motivo text,
    "compraId" text,
    "recepcionId" text,
    "usuarioId" text,
    "creadoEn" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: OperacionIdem; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."OperacionIdem" (
    clave text NOT NULL,
    "restauranteId" text NOT NULL,
    tipo text NOT NULL,
    resultado jsonb,
    "creadoEn" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: Pedido; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Pedido" (
    id text NOT NULL,
    numero integer NOT NULL,
    tipo public."TipoPedido" NOT NULL,
    estado public."EstadoPedido" DEFAULT 'PENDIENTE'::public."EstadoPedido" NOT NULL,
    "mesaId" text,
    "meseroId" text,
    "restauranteId" text NOT NULL,
    pagado boolean DEFAULT false NOT NULL,
    "metodoPago" text,
    total numeric(65,30),
    "tiempoInicio" timestamp(3) without time zone,
    "tiempoListo" timestamp(3) without time zone,
    "creadoEn" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "actualizadoEn" timestamp(3) without time zone NOT NULL
);


--
-- Name: Pedido_numero_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."Pedido_numero_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: Pedido_numero_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."Pedido_numero_seq" OWNED BY public."Pedido".numero;


--
-- Name: Producto; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Producto" (
    id text NOT NULL,
    nombre text NOT NULL,
    descripcion text,
    precio numeric(65,30) NOT NULL,
    imagen text,
    disponible boolean DEFAULT true NOT NULL,
    "categoriaId" text NOT NULL,
    "restauranteId" text NOT NULL,
    "requiereCocina" boolean DEFAULT true NOT NULL
);


--
-- Name: Proveedor; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Proveedor" (
    id text NOT NULL,
    nombre text NOT NULL,
    contacto text,
    telefono text,
    email text,
    notas text,
    activo boolean DEFAULT true NOT NULL,
    "restauranteId" text NOT NULL,
    "creadoEn" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: Recepcion; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Recepcion" (
    id text NOT NULL,
    "compraId" text NOT NULL,
    "restauranteId" text NOT NULL,
    "usuarioId" text,
    notas text,
    cerrada boolean DEFAULT false NOT NULL,
    "creadoEn" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: RecepcionItem; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."RecepcionItem" (
    id text NOT NULL,
    "recepcionId" text NOT NULL,
    "compraItemId" text NOT NULL,
    "insumoId" text NOT NULL,
    cantidad numeric(14,3) NOT NULL,
    "costoUnitario" numeric(14,2) NOT NULL
);


--
-- Name: RegistroActividad; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."RegistroActividad" (
    id text NOT NULL,
    "restauranteId" text NOT NULL,
    "usuarioId" text,
    "usuarioNombre" text NOT NULL,
    rol text NOT NULL,
    accion text NOT NULL,
    detalle text,
    ref text,
    metodo text NOT NULL,
    ruta text NOT NULL,
    estado integer NOT NULL,
    "creadoEn" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: Restaurante; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Restaurante" (
    id text NOT NULL,
    nombre text NOT NULL,
    direccion text,
    telefono text,
    logo text,
    "timerMesa" integer DEFAULT 45 NOT NULL,
    "creadoEn" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "pieTicket" text,
    "qrTicket" text,
    moneda text DEFAULT 'KZT'::text NOT NULL,
    "qrPago" text
);


--
-- Name: TrabajoImpresion; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."TrabajoImpresion" (
    id text NOT NULL,
    "restauranteId" text NOT NULL,
    "impresoraId" text,
    tipo text NOT NULL,
    referencia text,
    ok boolean NOT NULL,
    error text,
    ms integer,
    "usuarioId" text,
    "creadoEn" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: Usuario; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Usuario" (
    id text NOT NULL,
    nombre text NOT NULL,
    email text NOT NULL,
    "passwordHash" text NOT NULL,
    rol public."Rol" NOT NULL,
    activo boolean DEFAULT true NOT NULL,
    "restauranteId" text NOT NULL,
    "creadoEn" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: _prisma_migrations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public._prisma_migrations (
    id character varying(36) NOT NULL,
    checksum character varying(64) NOT NULL,
    finished_at timestamp with time zone,
    migration_name character varying(255) NOT NULL,
    logs text,
    rolled_back_at timestamp with time zone,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    applied_steps_count integer DEFAULT 0 NOT NULL
);


--
-- Name: Compra numero; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Compra" ALTER COLUMN numero SET DEFAULT nextval('public."Compra_numero_seq"'::regclass);


--
-- Name: Pedido numero; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Pedido" ALTER COLUMN numero SET DEFAULT nextval('public."Pedido_numero_seq"'::regclass);


--
-- Data for Name: Categoria; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."Categoria" (id, nombre, "restauranteId") FROM stdin;
cat-sopas	Супы	rest-polleria-1
cat-pollos	Горячие блюда	rest-polleria-1
cat-combos	Бизнес-ланч и сеты	rest-polleria-1
cat-acompanamientos	Гарниры и салаты	rest-polleria-1
cat-postres	Выпечка и десерты	rest-polleria-1
cat-bebidas	Напитки	rest-polleria-1
cat-extras	Соусы и добавки	rest-polleria-1
\.


--
-- Data for Name: Compra; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."Compra" (id, numero, estado, "proveedorId", "restauranteId", "usuarioId", "fechaEsperada", notas, total, "creadoEn", "actualizadoEn") FROM stdin;
cmv78gtox000tzvfyke9udrrn	108	RECIBIDA	cmv78db1v000qzvfy97r9tj5s	rest-polleria-1	cmv6q71yx0001u0306g1ml1hm	2026-10-03 00:00:00	закупка проведено	14000.00	2026-10-13 22:09:07.665	2026-10-13 22:09:27.207
cmv78kjnu0013zvfyigq3uok9	109	RECIBIDA	cmv78db1v000qzvfy97r9tj5s	rest-polleria-1	cmv6q71yx0001u0306g1ml1hm	\N	закупка проведено ждем поставщика	21750.00	2026-10-13 22:12:01.29	2026-10-13 22:12:13.472
\.


--
-- Data for Name: CompraItem; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."CompraItem" (id, "compraId", "insumoId", cantidad, "costoUnitario", "cantidadRecibida") FROM stdin;
cmv78gtox000vzvfy9p038esj	cmv78gtox000tzvfyke9udrrn	insumo-кетчуп	20.000	700.00	20.000
cmv78kjnu0015zvfyfk2qwlbv	cmv78kjnu0013zvfyigq3uok9	insumo-майонез	9.000	750.00	9.000
cmv78kjnu0016zvfypd9wgjxr	cmv78kjnu0013zvfyigq3uok9	insumo-огурцы	6.000	250.00	6.000
cmv78kjnu0017zvfyz9s658bq	cmv78kjnu0013zvfyigq3uok9	insumo-томатная-паста	15.000	900.00	15.000
\.


--
-- Data for Name: Impresora; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."Impresora" (id, "restauranteId", nombre, tipo, host, puerto, "nombreSistema", token, ancho, codepage, usos, corte, cajon, copias, activa, "creadoEn", auto) FROM stdin;
\.


--
-- Data for Name: Insumo; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."Insumo" (id, nombre, categoria, unidad, "stockActual", "stockMinimo", proveedor, "restauranteId", "creadoEn", "actualizadoEn", "costoUnitario") FROM stdin;
insumo-tomate	Помидоры	Овощи	кг	4.000000000000000000000000000000	2.000000000000000000000000000000	\N	rest-polleria-1	2026-10-13 13:37:39.108	2026-10-13 16:44:30.628	\N
insumo-pollo-entero	Курица целая	Мясо	шт	30.000000000000000000000000000000	10.000000000000000000000000000000	\N	rest-polleria-1	2026-10-13 13:37:39.098	2026-10-13 13:37:39.098	\N
insumo-papas	Картофель	Овощи	кг	25.000000000000000000000000000000	10.000000000000000000000000000000	\N	rest-polleria-1	2026-10-13 13:37:39.101	2026-10-13 13:37:39.101	\N
insumo-yuca	Маниок	Овощи	кг	10.000000000000000000000000000000	5.000000000000000000000000000000	\N	rest-polleria-1	2026-10-13 13:37:39.103	2026-10-13 13:37:39.103	\N
insumo-lechuga	Салат латук	Овощи	кг	3.000000000000000000000000000000	2.000000000000000000000000000000	\N	rest-polleria-1	2026-10-13 13:37:39.106	2026-10-13 13:37:39.106	\N
insumo-carbón	Древесный уголь	Топливо	кг	50.000000000000000000000000000000	20.000000000000000000000000000000	\N	rest-polleria-1	2026-10-13 13:37:39.11	2026-10-13 13:37:39.11	\N
insumo-aceite-vegetal	Растительное масло	Масла	л	10.000000000000000000000000000000	4.000000000000000000000000000000	\N	rest-polleria-1	2026-10-13 13:37:39.112	2026-10-13 13:37:39.112	\N
insumo-sal	Соль	Специи	кг	5.000000000000000000000000000000	2.000000000000000000000000000000	\N	rest-polleria-1	2026-10-13 13:37:39.114	2026-10-13 13:37:39.114	\N
insumo-condimento-pollería	Приправа для курицы	Специи	кг	2.000000000000000000000000000000	1.000000000000000000000000000000	\N	rest-polleria-1	2026-10-13 13:37:39.116	2026-10-13 13:37:39.116	\N
insumo-ají-amarillo	Перец ахи амарильо	Специи	кг	1.000000000000000000000000000000	0.500000000000000000000000000000	\N	rest-polleria-1	2026-10-13 13:37:39.118	2026-10-13 13:37:39.118	\N
insumo-limón	Лимон	Овощи	кг	3.000000000000000000000000000000	2.000000000000000000000000000000	\N	rest-polleria-1	2026-10-13 13:37:39.119	2026-10-13 13:37:39.119	\N
insumo-кетчуп	Кетчуп	Соусы	кг	20.000000000000000000000000000000	2.000000000000000000000000000000	\N	rest-polleria-1	2026-10-13 16:20:23.253	2026-10-13 22:09:27.174	700.00
insumo-майонез	Майонез	Соусы	кг	9.000000000000000000000000000000	2.000000000000000000000000000000	\N	rest-polleria-1	2026-10-13 16:20:23.253	2026-10-13 22:12:13.458	750.00
insumo-томатная-паста	Томатная паста	Консервы	кг	15.000000000000000000000000000000	2.000000000000000000000000000000	\N	rest-polleria-1	2026-10-13 16:20:23.253	2026-10-13 22:12:13.458	900.00
insumo-огурцы	Огурцы	Овощи	кг	6.000000000000000000000000000000	3.000000000000000000000000000000	\N	rest-polleria-1	2026-10-13 16:20:23.253	2026-10-13 22:12:13.458	250.00
\.


--
-- Data for Name: ItemPedido; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."ItemPedido" (id, "pedidoId", "productoId", cantidad, precio, subtotal, servido) FROM stdin;
cmv6qx8uk0004faoe4bn3s18z	cmv6qx8uk0002faoe4s8fhhmj	prod-agua	1	3.000000000000000000000000000000	3.000000000000000000000000000000	t
cmv6qxia10006faoe2z63oyps	cmv6qx8uk0002faoe4s8fhhmj	prod-coca-grande	1	10.000000000000000000000000000000	10.000000000000000000000000000000	t
cmv6qxia10007faoe9q4jdniz	cmv6qx8uk0002faoe4s8fhhmj	prod-combo-broaster2	1	52.000000000000000000000000000000	52.000000000000000000000000000000	t
cmv6qxia10008faoev30f99q1	cmv6qx8uk0002faoe4s8fhhmj	prod-coca-personal	1	5.000000000000000000000000000000	5.000000000000000000000000000000	t
cmv6qzz9v000efaoectr05sia	cmv6qzz9v000cfaoegll771b6	prod-coca-personal	2	5.000000000000000000000000000000	10.000000000000000000000000000000	t
cmv6r0ex4000gfaoe57eey8v0	cmv6qzz9v000cfaoegll771b6	prod-octavo-pollo	1	10.000000000000000000000000000000	10.000000000000000000000000000000	t
cmv6r0ex4000hfaoeaek7w8ky	cmv6qzz9v000cfaoegll771b6	prod-cuarto-pollo	1	16.000000000000000000000000000000	16.000000000000000000000000000000	t
cmv6sf71o0006d7zg29raqq84	cmv6sf71o0004d7zg9zz0nunc	prod-cuarto-pollo	2	16.000000000000000000000000000000	32.000000000000000000000000000000	t
cmv6t34c00004bj1ncyp16lxw	cmv6t34c00002bj1n2vfep7np	prod-yuca-frita	1	8.000000000000000000000000000000	8.000000000000000000000000000000	t
cmv6t34c00005bj1nyn2v4qxq	cmv6t34c00002bj1n2vfep7np	prod-chaufa-arroz	1	10.000000000000000000000000000000	10.000000000000000000000000000000	t
cmv6t34c00006bj1n4jy81ukc	cmv6t34c00002bj1n2vfep7np	prod-ensalada	1	5.000000000000000000000000000000	5.000000000000000000000000000000	t
cmv6t6vbx000ebj1np2fqkv6c	cmv6t6vbx000cbj1n5z6uowbh	prod-papas-fritas	1	8.000000000000000000000000000000	8.000000000000000000000000000000	t
cmv6t6vby000fbj1nasavmxb7	cmv6t6vbx000cbj1n5z6uowbh	prod-arroz	1	4.000000000000000000000000000000	4.000000000000000000000000000000	t
cmv6t7kmy000lbj1n4glorqyo	cmv6t7kmy000jbj1nuymxol41	prod-octavo-pollo	1	10.000000000000000000000000000000	10.000000000000000000000000000000	t
cmv6teg50000vbj1nkh3vnylc	cmv6teg50000tbj1nuo5dtis8	prod-combo-broaster2	1	52.000000000000000000000000000000	52.000000000000000000000000000000	t
cmv6tgclp0013bj1nvonz8kl0	cmv6tgclp0011bj1nirckgt3d	prod-pollo-entero	3	55.000000000000000000000000000000	165.000000000000000000000000000000	t
cmv6tgclp0014bj1niw2ui7v6	cmv6tgclp0011bj1nirckgt3d	prod-medio-pollo	1	29.000000000000000000000000000000	29.000000000000000000000000000000	t
cmv6tgclp0015bj1n8agfessb	cmv6tgclp0011bj1nirckgt3d	prod-cuarto-pollo	3	16.000000000000000000000000000000	48.000000000000000000000000000000	t
cmv6ti5ns001dbj1ndnuxkoqf	cmv6ti5nr001bbj1nssg20pav	prod-combo-duo	4	42.000000000000000000000000000000	168.000000000000000000000000000000	t
cmv6vx46b000410ca01qgb8uw	cmv6vx46b000210cat23anajg	prod-pollo-entero	3	55.000000000000000000000000000000	165.000000000000000000000000000000	t
cmv6tyiqq0004n21sjwqtm61b	cmv6tyiqq0002n21splr21kvd	prod-combo-broaster2	1	52.000000000000000000000000000000	52.000000000000000000000000000000	t
cmv6u2ilw0004vj6lc6ud51qb	cmv6u2ilw0002vj6lo50946kz	prod-combo-broaster2	1	52.000000000000000000000000000000	52.000000000000000000000000000000	t
cmv6ubgkb000faj36zjcqzx4t	cmv6ubgka000daj367dwa4h90	prod-yuca-frita	1	8.000000000000000000000000000000	8.000000000000000000000000000000	t
cmv6ubgkb000gaj36d5tw6xu3	cmv6ubgka000daj367dwa4h90	prod-combo-broaster2	1	52.000000000000000000000000000000	52.000000000000000000000000000000	t
cmv6ud6vo000waj36b4ipy5qs	cmv6ud6vo000uaj3688qrk2j6	prod-yuca-frita	1	8.000000000000000000000000000000	8.000000000000000000000000000000	t
cmv6ud6vo000xaj36xz2gf22c	cmv6ud6vo000uaj3688qrk2j6	prod-papas-fritas	1	8.000000000000000000000000000000	8.000000000000000000000000000000	t
cmv6ud6vo000yaj36v24ta2bp	cmv6ud6vo000uaj3688qrk2j6	prod-arroz	1	4.000000000000000000000000000000	4.000000000000000000000000000000	t
cmv6uests001yaj36b8t0gxp1	cmv6uests001waj3629gk09je	prod-combo-broaster2	1	52.000000000000000000000000000000	52.000000000000000000000000000000	t
cmv6uests001zaj36y2il2uad	cmv6uests001waj3629gk09je	prod-combo-duo	1	42.000000000000000000000000000000	42.000000000000000000000000000000	t
cmv6uests0020aj363vij0dyl	cmv6uests001waj3629gk09je	prod-combo-personal	1	22.000000000000000000000000000000	22.000000000000000000000000000000	t
cmv6uefl3001daj36t9tfwcav	cmv6uefl3001baj364fls5v76	prod-papas-fritas	1	8.000000000000000000000000000000	8.000000000000000000000000000000	t
cmv6uefl3001eaj36g5cc7jip	cmv6uefl3001baj364fls5v76	prod-arroz	1	4.000000000000000000000000000000	4.000000000000000000000000000000	t
cmv6uefl3001faj36xm2vfjb2	cmv6uefl3001baj364fls5v76	prod-chaufa-arroz	1	10.000000000000000000000000000000	10.000000000000000000000000000000	t
cmv6uf0iw0025aj36huggow42	cmv6uf0iw0023aj36x08nitrz	prod-combo-broaster2	1	52.000000000000000000000000000000	52.000000000000000000000000000000	t
cmv6uf0iw0026aj36k6cm0pik	cmv6uf0iw0023aj36x08nitrz	prod-combo-duo	1	42.000000000000000000000000000000	42.000000000000000000000000000000	t
cmv6w83vc001f1x0unj2b5ckj	cmv6w83vc001d1x0ucr53wwjy	prod-pollo-entero	1	55.000000000000000000000000000000	55.000000000000000000000000000000	t
cmv77v5gr0004zvfy33nt7can	cmv77v5gr0002zvfyzw0lv8pl	prod-ketchup	1	1.000000000000000000000000000000	1.000000000000000000000000000000	t
cmv829z3y0006pe3l1kvcmjnj	cmv829z3y0004pe3lxhfud82f	prod-manty	2	15.000000000000000000000000000000	30.000000000000000000000000000000	t
cmv77xxrp000bzvfy02huq68k	cmv77xxro0009zvfylgg3byez	prod-ketchup	3	1.000000000000000000000000000000	3.000000000000000000000000000000	t
cmv783va4000izvfytj7cv19t	cmv783va4000gzvfyuelltiak	prod-combo-broaster2	3	52.000000000000000000000000000000	156.000000000000000000000000000000	t
cmv783va4000jzvfyrm9sfo2q	cmv783va4000gzvfyuelltiak	prod-combo-personal	4	22.000000000000000000000000000000	88.000000000000000000000000000000	t
cmv783va4000kzvfyv5gm734c	cmv783va4000gzvfyuelltiak	prod-combo-duo	2	42.000000000000000000000000000000	84.000000000000000000000000000000	t
cmv78lkgc001lzvfywfu25zmp	cmv78lkgc001jzvfy12enpucr	prod-aji-verde	1	2.000000000000000000000000000000	2.000000000000000000000000000000	t
cmv78lkgc001mzvfyuya62pqh	cmv78lkgc001jzvfy12enpucr	prod-salsa-huancaina	1	3.000000000000000000000000000000	3.000000000000000000000000000000	t
cmv78vq360008zq9i09eblc1c	cmv78vq360006zq9ixyn3d8as	prod-arroz	1	4.000000000000000000000000000000	4.000000000000000000000000000000	t
cmv78vxys000wzq9i46ond91i	cmv78vxys000uzq9itd4dx380	prod-arroz	1	4.000000000000000000000000000000	4.000000000000000000000000000000	t
cmv6yz1ni0004igvm4prbxdh0	cmv6yz1ni0002igvms1m64eqn	prod-coca-personal	4	5.000000000000000000000000000000	20.000000000000000000000000000000	t
cmv6z4nw0000s120a1uy48xmc	cmv6z4nw0000q120aaveqgd7p	prod-pollo-entero	1	55.000000000000000000000000000000	55.000000000000000000000000000000	t
cmv6z4nw0000t120aysmaxz01	cmv6z4nw0000q120aaveqgd7p	prod-cuarto-pollo	1	16.000000000000000000000000000000	16.000000000000000000000000000000	t
cmv6z4nw0000u120ajc7p57ue	cmv6z4nw0000q120aaveqgd7p	prod-medio-pollo	1	29.000000000000000000000000000000	29.000000000000000000000000000000	t
cmv6u8lyt0006aj36571g2zr8	cmv6u8lyt0004aj36qilra86i	prod-medio-pollo	1	29.000000000000000000000000000000	29.000000000000000000000000000000	t
cmv6u8lyt0007aj36pg3riau8	cmv6u8lyt0004aj36qilra86i	prod-octavo-pollo	1	10.000000000000000000000000000000	10.000000000000000000000000000000	t
cmv6uceq1000oaj362bjx1ccq	cmv6uceq1000maj36213dfu7v	prod-yuca-frita	1	8.000000000000000000000000000000	8.000000000000000000000000000000	t
cmv6ue77o0016aj36wy283d3s	cmv6ue77o0014aj36dgp568yy	prod-yuca-frita	1	8.000000000000000000000000000000	8.000000000000000000000000000000	t
cmv6ue77o0017aj367tuufcpa	cmv6ue77o0014aj36dgp568yy	prod-papas-fritas	1	8.000000000000000000000000000000	8.000000000000000000000000000000	t
cmv6ue77o0018aj3636nrnlof	cmv6ue77o0014aj36dgp568yy	prod-arroz	1	4.000000000000000000000000000000	4.000000000000000000000000000000	t
cmv6ueojh001raj36dekvamns	cmv6ueojh001paj366vnt3kg8	prod-combo-broaster2	1	52.000000000000000000000000000000	52.000000000000000000000000000000	t
cmv6ueojh001saj36kb5roz4l	cmv6ueojh001paj366vnt3kg8	prod-combo-duo	1	42.000000000000000000000000000000	42.000000000000000000000000000000	t
cmv6ueojh001taj36yhbpfqrg	cmv6ueojh001paj366vnt3kg8	prod-combo-personal	1	22.000000000000000000000000000000	22.000000000000000000000000000000	t
cmv6uejk4001kaj36u74d2dvh	cmv6uejk4001iaj36mz1vwpkf	prod-combo-broaster2	1	52.000000000000000000000000000000	52.000000000000000000000000000000	t
cmv6uejk4001laj36gdgw0ckj	cmv6uejk4001iaj36mz1vwpkf	prod-combo-duo	1	42.000000000000000000000000000000	42.000000000000000000000000000000	t
cmv6uejk4001maj36jtdvky16	cmv6uejk4001iaj36mz1vwpkf	prod-combo-personal	1	22.000000000000000000000000000000	22.000000000000000000000000000000	t
cmv6uf62j002caj36elopg9kn	cmv6uf62j002aaj36hrjk26ls	prod-combo-broaster2	1	52.000000000000000000000000000000	52.000000000000000000000000000000	t
cmv6uf62j002daj36atfjc8kk	cmv6uf62j002aaj36hrjk26ls	prod-combo-duo	1	42.000000000000000000000000000000	42.000000000000000000000000000000	t
cmv6uf62j002eaj36jb41ctfp	cmv6uf62j002aaj36hrjk26ls	prod-combo-personal	1	22.000000000000000000000000000000	22.000000000000000000000000000000	t
cmv6ufbts002jaj36noie9fw6	cmv6ufbtr002haj365sbu3z27	prod-combo-broaster2	1	52.000000000000000000000000000000	52.000000000000000000000000000000	t
cmv6ufbts002kaj36pdd9q81e	cmv6ufbtr002haj365sbu3z27	prod-pollo-entero	1	55.000000000000000000000000000000	55.000000000000000000000000000000	t
cmv6ufghf002vaj3622853b2u	cmv6ufghf002taj36p0px8neg	prod-pollo-entero	1	55.000000000000000000000000000000	55.000000000000000000000000000000	t
cmv6uf0iw0027aj36hq2pafq1	cmv6uf0iw0023aj36x08nitrz	prod-combo-personal	1	22.000000000000000000000000000000	22.000000000000000000000000000000	t
cmv6ufghf002waj365pk4y57o	cmv6ufghf002taj36p0px8neg	prod-medio-pollo	1	29.000000000000000000000000000000	29.000000000000000000000000000000	t
cmv6ug8qu003daj36mp4ohiqs	cmv6ug8qu003baj36pla2xpet	prod-combo-broaster2	1	52.000000000000000000000000000000	52.000000000000000000000000000000	t
cmv6ug8qu003eaj36cvvx3ptk	cmv6ug8qu003baj36pla2xpet	prod-combo-duo	1	42.000000000000000000000000000000	42.000000000000000000000000000000	t
cmv6ufq990036aj369mcm30ko	cmv6ufq990032aj36qvdp07al	prod-combo-personal	1	22.000000000000000000000000000000	22.000000000000000000000000000000	t
cmv6ufq990034aj361iqw9zec	cmv6ufq990032aj36qvdp07al	prod-combo-broaster2	1	52.000000000000000000000000000000	52.000000000000000000000000000000	t
cmv6ufq990035aj36wrhokh0w	cmv6ufq990032aj36qvdp07al	prod-combo-duo	1	42.000000000000000000000000000000	42.000000000000000000000000000000	t
cmv6ugcj5003kaj36j696j25e	cmv6ugcj5003iaj368567r12l	prod-combo-broaster2	1	52.000000000000000000000000000000	52.000000000000000000000000000000	t
cmv6ugcj5003laj36pp4h3o3s	cmv6ugcj5003iaj368567r12l	prod-combo-duo	1	42.000000000000000000000000000000	42.000000000000000000000000000000	t
cmv6up2q5004eaj368hsm20ef	cmv6up2q5004caj3636jolc0e	prod-combo-broaster2	1	52.000000000000000000000000000000	52.000000000000000000000000000000	t
cmv6uwddp0006d0rd8aqjgrqw	cmv6uwddp0004d0rd6accgxq6	prod-papas-fritas	1	8.000000000000000000000000000000	8.000000000000000000000000000000	t
cmv6uwddp0007d0rdcrke4dgu	cmv6uwddp0004d0rd6accgxq6	prod-arroz	1	4.000000000000000000000000000000	4.000000000000000000000000000000	t
cmv6uwddp0008d0rdwwmfbjm2	cmv6uwddp0004d0rd6accgxq6	prod-chaufa-arroz	1	10.000000000000000000000000000000	10.000000000000000000000000000000	t
cmv6uy63g000gd0rdrqb6kng6	cmv6uy63f000ed0rdkkchanlt	prod-medio-pollo	1	29.000000000000000000000000000000	29.000000000000000000000000000000	t
cmv6uy63g000hd0rdkbmo5gtz	cmv6uy63f000ed0rdkkchanlt	prod-cuarto-pollo	1	16.000000000000000000000000000000	16.000000000000000000000000000000	t
cmv6uy63g000id0rdoa1ia8rq	cmv6uy63f000ed0rdkkchanlt	prod-combo-broaster2	1	52.000000000000000000000000000000	52.000000000000000000000000000000	t
cmv6v6dc9000n8ka6a3oogfj2	cmv6v6dc9000l8ka6a9ryx57e	prod-combo-broaster2	1	52.000000000000000000000000000000	52.000000000000000000000000000000	t
cmv6v6dc9000o8ka6t6dgnag4	cmv6v6dc9000l8ka6a9ryx57e	prod-combo-personal	1	22.000000000000000000000000000000	22.000000000000000000000000000000	t
cmv6v79q6000x8ka6ngfnruz6	cmv6v79q6000v8ka6655jqffs	prod-combo-duo	1	42.000000000000000000000000000000	42.000000000000000000000000000000	t
cmv6v79q6000y8ka6rtprprl4	cmv6v79q6000v8ka6655jqffs	prod-combo-personal	1	22.000000000000000000000000000000	22.000000000000000000000000000000	t
cmv6v79q6000z8ka6z1sirpgw	cmv6v79q6000v8ka6655jqffs	prod-combo-familiar	1	65.000000000000000000000000000000	65.000000000000000000000000000000	t
cmv6v79q600108ka67tsxe3ck	cmv6v79q6000v8ka6655jqffs	prod-combo-broaster	1	18.000000000000000000000000000000	18.000000000000000000000000000000	t
cmv6v8hhq00198ka6gupgxyak	cmv6v8hhq00178ka6ahhw8tic	prod-combo-duo	1	42.000000000000000000000000000000	42.000000000000000000000000000000	t
cmv6v8hhq001a8ka6d8nq3yfv	cmv6v8hhq00178ka6ahhw8tic	prod-combo-familiar	1	65.000000000000000000000000000000	65.000000000000000000000000000000	t
cmv6v8hhq001b8ka6kh8gl283	cmv6v8hhq00178ka6ahhw8tic	prod-combo-broaster	1	18.000000000000000000000000000000	18.000000000000000000000000000000	t
\.


--
-- Data for Name: Mesa; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."Mesa" (id, numero, capacidad, estado, "restauranteId") FROM stdin;
mesa-5	5	4	LIBRE	rest-polleria-1
mesa-3	3	4	LIBRE	rest-polleria-1
mesa-1	1	2	LIBRE	rest-polleria-1
mesa-2	2	2	LIBRE	rest-polleria-1
mesa-6	6	4	LIBRE	rest-polleria-1
mesa-7	7	4	LIBRE	rest-polleria-1
mesa-8	8	4	LIBRE	rest-polleria-1
mesa-10	10	6	LIBRE	rest-polleria-1
mesa-12	12	8	LIBRE	rest-polleria-1
mesa-11	11	6	LIBRE	rest-polleria-1
mesa-4	4	4	LIBRE	rest-polleria-1
mesa-9	9	6	LIBRE	rest-polleria-1
\.


--
-- Data for Name: MovimientoInventario; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."MovimientoInventario" (id, "restauranteId", "insumoId", tipo, cantidad, saldo, "costoUnitario", motivo, "compraId", "recepcionId", "usuarioId", "creadoEn") FROM stdin;
cmv78h8ro0010zvfyocy8bw54	rest-polleria-1	insumo-кетчуп	COMPRA	20.000	20.000	700.00	Приёмка закупки	cmv78gtox000tzvfyke9udrrn	cmv78h8r9000yzvfyrtho397m	cmv6q71yx0001u0306g1ml1hm	2026-10-13 22:09:27.204
cmv78kt25001ezvfypy0l7h36	rest-polleria-1	insumo-майонез	COMPRA	9.000	9.000	750.00	Приёмка закупки	cmv78kjnu0013zvfyigq3uok9	cmv78kt1z001azvfy638lqxbz	cmv6q71yx0001u0306g1ml1hm	2026-10-13 22:12:13.47
cmv78kt25001fzvfywo7yes05	rest-polleria-1	insumo-огурцы	COMPRA	6.000	6.000	250.00	Приёмка закупки	cmv78kjnu0013zvfyigq3uok9	cmv78kt1z001azvfy638lqxbz	cmv6q71yx0001u0306g1ml1hm	2026-10-13 22:12:13.47
cmv78kt26001gzvfyhdluy1rl	rest-polleria-1	insumo-томатная-паста	COMPRA	15.000	15.000	900.00	Приёмка закупки	cmv78kjnu0013zvfyigq3uok9	cmv78kt1z001azvfy638lqxbz	cmv6q71yx0001u0306g1ml1hm	2026-10-13 22:12:13.47
\.


--
-- Data for Name: OperacionIdem; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."OperacionIdem" (clave, "restauranteId", tipo, resultado, "creadoEn") FROM stdin;
0ec4e352-b72e-4896-89cb-43b7005b8ded	rest-polleria-1	compra	{"id": "cmv78gtox000tzvfyke9udrrn", "items": [{"id": "cmv78gtox000vzvfy9p038esj", "nombre": "Кетчуп", "unidad": "кг", "cantidad": 20, "insumoId": "insumo-кетчуп", "costoUnitario": 700, "cantidadRecibida": 0}], "notas": "закупка проведено", "total": 14000, "estado": "PEDIDA", "numero": 108, "creadoEn": "2026-10-13T22:09:07.665Z", "proveedor": {"id": "cmv78db1v000qzvfy97r9tj5s", "nombre": "Арсен Құлбарақов Hains", "telefono": "87053556544"}, "actualizadoEn": "2026-10-13T22:09:07.665Z", "fechaEsperada": "2026-10-03T00:00:00.000Z"}	2026-10-13 22:09:07.655
20d4ec71-f062-4e6f-af93-ffba9e8a562b	rest-polleria-1	recepcion:cmv78gtox000tzvfyke9udrrn	{"id": "cmv78gtox000tzvfyke9udrrn", "items": [{"id": "cmv78gtox000vzvfy9p038esj", "nombre": "Кетчуп", "unidad": "кг", "cantidad": 20, "insumoId": "insumo-кетчуп", "costoUnitario": 700, "cantidadRecibida": 20}], "notas": "закупка проведено", "total": 14000, "estado": "RECIBIDA", "numero": 108, "creadoEn": "2026-10-13T22:09:07.665Z", "proveedor": {"id": "cmv78db1v000qzvfy97r9tj5s", "nombre": "Арсен Құлбарақов Hains", "telefono": "87053556544"}, "actualizadoEn": "2026-10-13T22:09:27.207Z", "fechaEsperada": "2026-10-03T00:00:00.000Z"}	2026-10-13 22:09:27.174
c510991b-fda0-46d4-9464-d27eed77f06d	rest-polleria-1	compra	{"id": "cmv78kjnu0013zvfyigq3uok9", "items": [{"id": "cmv78kjnu0015zvfyfk2qwlbv", "nombre": "Майонез", "unidad": "кг", "cantidad": 9, "insumoId": "insumo-майонез", "costoUnitario": 750, "cantidadRecibida": 0}, {"id": "cmv78kjnu0016zvfypd9wgjxr", "nombre": "Огурцы", "unidad": "кг", "cantidad": 6, "insumoId": "insumo-огурцы", "costoUnitario": 250, "cantidadRecibida": 0}, {"id": "cmv78kjnu0017zvfyz9s658bq", "nombre": "Томатная паста", "unidad": "кг", "cantidad": 15, "insumoId": "insumo-томатная-паста", "costoUnitario": 900, "cantidadRecibida": 0}], "notas": "закупка проведено ждем поставщика", "total": 21750, "estado": "PEDIDA", "numero": 109, "creadoEn": "2026-10-13T22:12:01.290Z", "proveedor": {"id": "cmv78db1v000qzvfy97r9tj5s", "nombre": "Арсен Құлбарақов Hains", "telefono": "87053556544"}, "actualizadoEn": "2026-10-13T22:12:01.290Z", "fechaEsperada": null}	2026-10-13 22:12:01.286
6ac0cda6-a056-408b-b9aa-fd5a64b280ec	rest-polleria-1	recepcion:cmv78kjnu0013zvfyigq3uok9	{"id": "cmv78kjnu0013zvfyigq3uok9", "items": [{"id": "cmv78kjnu0015zvfyfk2qwlbv", "nombre": "Майонез", "unidad": "кг", "cantidad": 9, "insumoId": "insumo-майонез", "costoUnitario": 750, "cantidadRecibida": 9}, {"id": "cmv78kjnu0016zvfypd9wgjxr", "nombre": "Огурцы", "unidad": "кг", "cantidad": 6, "insumoId": "insumo-огурцы", "costoUnitario": 250, "cantidadRecibida": 6}, {"id": "cmv78kjnu0017zvfyz9s658bq", "nombre": "Томатная паста", "unidad": "кг", "cantidad": 15, "insumoId": "insumo-томатная-паста", "costoUnitario": 900, "cantidadRecibida": 15}], "notas": "закупка проведено ждем поставщика", "total": 21750, "estado": "RECIBIDA", "numero": 109, "creadoEn": "2026-10-13T22:12:01.290Z", "proveedor": {"id": "cmv78db1v000qzvfy97r9tj5s", "nombre": "Арсен Құлбарақов Hains", "telefono": "87053556544"}, "actualizadoEn": "2026-10-13T22:12:13.472Z", "fechaEsperada": null}	2026-10-13 22:12:13.458
\.


--
-- Data for Name: Pedido; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."Pedido" (id, numero, tipo, estado, "mesaId", "meseroId", "restauranteId", pagado, "metodoPago", total, "tiempoInicio", "tiempoListo", "creadoEn", "actualizadoEn") FROM stdin;
cmv6tyiqq0002n21splr21kvd	30012	EN_MESA	PAGADO	mesa-2	cmv6q71yx0001u0306g1ml1hm	rest-polleria-1	t	Tarjeta	52.000000000000000000000000000000	\N	2026-10-13 15:23:02.17	2026-10-13 15:22:59.043	2026-10-13 15:23:56.969
cmv6qzz9v000cfaoegll771b6	2	EN_MESA	PAGADO	mesa-2	cmv6q71yx0001u0306g1ml1hm	rest-polleria-1	t	Tarjeta	36.000000000000000000000000000000	\N	2026-10-13 14:00:37.904	2026-10-13 14:00:08.275	2026-10-13 14:01:25.458
cmv6vx46b000210cat23anajg	30040	EN_MESA	PAGADO	mesa-1	cmv6q725t0007u030var57gzw	rest-polleria-1	t	Tarjeta	165.000000000000000000000000000000	2026-10-13 16:18:00.449	2026-10-13 16:18:05.33	2026-10-13 16:17:52.737	2026-10-13 16:18:09.685
cmv6qx8uk0002faoe4s8fhhmj	1	EN_MESA	PAGADO	mesa-3	cmv6q71yx0001u0306g1ml1hm	rest-polleria-1	t	Tarjeta	70.000000000000000000000000000000	\N	2026-10-13 13:58:52.123	2026-10-13 13:58:00.714	2026-10-13 14:37:33.35
cmv6sf71o0004d7zg9zz0nunc	3	EN_MESA	PAGADO	mesa-1	cmv6q71yx0001u0306g1ml1hm	rest-polleria-1	t	Tarjeta	32.000000000000000000000000000000	\N	2026-10-13 14:40:31.817	2026-10-13 14:39:57.805	2026-10-13 14:40:51.893
cmv6u2ilw0002vj6lo50946kz	30014	EN_MESA	PAGADO	mesa-3	cmv6q71yx0001u0306g1ml1hm	rest-polleria-1	t	Tarjeta	52.000000000000000000000000000000	\N	2026-10-13 15:26:06.756	2026-10-13 15:26:05.493	2026-10-13 15:27:22.249
cmv6t34c00002bj1n2vfep7np	4	EN_MESA	PAGADO	mesa-8	cmv6q71yx0001u0306g1ml1hm	rest-polleria-1	t	Tarjeta	23.000000000000000000000000000000	\N	2026-10-13 14:58:54.391	2026-10-13 14:58:34.032	2026-10-13 14:59:24.007
cmv6ti5nr001bbj1nssg20pav	9	EN_MESA	PAGADO	mesa-10	cmv6q71yx0001u0306g1ml1hm	rest-polleria-1	t	Tarjeta	168.000000000000000000000000000000	\N	2026-10-13 15:10:25.869	2026-10-13 15:10:15.592	2026-10-13 15:30:41.566
cmv829z3y0004pe3lxhfud82f	30063	EN_MESA	PAGADO	mesa-1	cmv6q725t0007u030var57gzw	rest-polleria-1	t	Efectivo	30.000000000000000000000000000000	2026-10-14 12:04:06.58	2026-10-14 12:04:12.125	2026-10-14 12:03:36.575	2026-10-14 12:04:36.632
cmv6t6vbx000cbj1n5z6uowbh	5	EN_MESA	PAGADO	mesa-3	cmv6q71yx0001u0306g1ml1hm	rest-polleria-1	t	Tarjeta	12.000000000000000000000000000000	\N	2026-10-13 15:01:37.105	2026-10-13 15:01:28.99	2026-10-13 15:02:29.63
cmv6ueojh001paj366vnt3kg8	30022	EN_MESA	PAGADO	mesa-7	cmv6q71yx0001u0306g1ml1hm	rest-polleria-1	t	QR	116.000000000000000000000000000000	\N	2026-10-13 15:36:06.986	2026-10-13 15:35:33.054	2026-10-13 15:37:47.897
cmv6v8hhq00178ka6ahhw8tic	30039	EN_MESA	PAGADO	mesa-9	cmv6q725t0007u030var57gzw	rest-polleria-1	t	QR	125.000000000000000000000000000000	2026-10-13 15:58:48.38	2026-10-13 15:58:52.005	2026-10-13 15:58:43.598	2026-10-13 15:58:57.337
cmv6t7kmy000jbj1nuymxol41	6	EN_MESA	PAGADO	mesa-1	cmv6q71yx0001u0306g1ml1hm	rest-polleria-1	t	Tarjeta	10.000000000000000000000000000000	\N	2026-10-13 15:06:42.189	2026-10-13 15:02:01.786	2026-10-13 15:07:10.446
cmv6ubgka000daj367dwa4h90	30016	EN_MESA	PAGADO	mesa-1	cmv6q71yx0001u0306g1ml1hm	rest-polleria-1	t	Transferencia	60.000000000000000000000000000000	\N	2026-10-13 15:33:04.018	2026-10-13 15:33:02.747	2026-10-13 15:33:18.734
cmv6teg50000tbj1nuo5dtis8	7	EN_MESA	PAGADO	mesa-3	cmv6q71yx0001u0306g1ml1hm	rest-polleria-1	t	Tarjeta	52.000000000000000000000000000000	\N	2026-10-13 15:07:39.721	2026-10-13 15:07:22.548	2026-10-13 15:08:07.643
cmv6tgclp0011bj1nirckgt3d	8	EN_MESA	PAGADO	mesa-4	cmv6q71yx0001u0306g1ml1hm	rest-polleria-1	t	Tarjeta	242.000000000000000000000000000000	\N	2026-10-13 15:08:54.96	2026-10-13 15:08:51.277	2026-10-13 15:09:50.529
cmv6ud6vo000uaj3688qrk2j6	30018	EN_MESA	PAGADO	mesa-2	cmv6q71yx0001u0306g1ml1hm	rest-polleria-1	t	Efectivo	20.000000000000000000000000000000	\N	2026-10-13 15:34:38.859	2026-10-13 15:34:23.508	2026-10-13 15:34:54.769
cmv6uf62j002aaj36hrjk26ls	30025	EN_MESA	PAGADO	mesa-1	cmv6q71yx0001u0306g1ml1hm	rest-polleria-1	t	Efectivo	116.000000000000000000000000000000	\N	2026-10-13 15:36:08	2026-10-13 15:35:55.771	2026-10-13 15:37:10.603
cmv6ufghf002taj36p0px8neg	30027	EN_MESA	PAGADO	mesa-3	cmv6q71yx0001u0306g1ml1hm	rest-polleria-1	t	Tarjeta	84.000000000000000000000000000000	\N	2026-10-13 15:36:09.77	2026-10-13 15:36:09.268	2026-10-13 15:37:27.976
cmv6uests001waj3629gk09je	30023	EN_MESA	PAGADO	mesa-6	cmv6q71yx0001u0306g1ml1hm	rest-polleria-1	t	Transferencia	116.000000000000000000000000000000	\N	2026-10-13 15:36:08.547	2026-10-13 15:35:38.608	2026-10-13 15:37:42.591
cmv6uefl3001baj364fls5v76	30020	EN_MESA	PAGADO	mesa-9	cmv6q71yx0001u0306g1ml1hm	rest-polleria-1	t	Tarjeta	22.000000000000000000000000000000	\N	2026-10-13 15:36:09.45	2026-10-13 15:35:21.447	2026-10-13 15:37:57.061
cmv6ufq990032aj36qvdp07al	30028	EN_MESA	PAGADO	mesa-12	cmv6q71yx0001u0306g1ml1hm	rest-polleria-1	t	Transferencia	116.000000000000000000000000000000	\N	2026-10-13 15:36:23.618	2026-10-13 15:36:21.934	2026-10-13 15:38:06.67
cmv6uf0iw0023aj36x08nitrz	30024	EN_MESA	PAGADO	mesa-11	cmv6q71yx0001u0306g1ml1hm	rest-polleria-1	t	Tarjeta	116.000000000000000000000000000000	\N	2026-10-13 15:36:10.275	2026-10-13 15:35:48.584	2026-10-13 15:38:12.599
cmv6up2q5004caj3636jolc0e	30031	EN_MESA	PAGADO	mesa-2	cmv6q71yx0001u0306g1ml1hm	rest-polleria-1	t	Tarjeta	52.000000000000000000000000000000	\N	2026-10-13 15:43:41.383	2026-10-13 15:43:37.997	2026-10-13 15:49:11.18
cmv6uy63f000ed0rdkkchanlt	30033	EN_MESA	PAGADO	mesa-3	cmv6q725t0007u030var57gzw	rest-polleria-1	t	Transferencia	97.000000000000000000000000000000	\N	2026-10-13 15:53:03.173	2026-10-13 15:50:42.268	2026-10-13 15:53:07.358
cmv6w83vc001d1x0ucr53wwjy	30041	EN_MESA	PAGADO	mesa-1	cmv6q71yx0001u0306g1ml1hm	rest-polleria-1	t	Tarjeta	55.000000000000000000000000000000	2026-10-13 16:26:34.675	2026-10-13 16:26:37.659	2026-10-13 16:26:25.56	2026-10-13 16:28:10.033
cmv77v5gr0002zvfyzw0lv8pl	30054	EN_MESA	PAGADO	mesa-2	cmv6q71yx0001u0306g1ml1hm	rest-polleria-1	t	Efectivo	1.000000000000000000000000000000	\N	2026-10-13 21:52:16.489	2026-10-13 21:52:16.491	2026-10-13 21:52:51.351
cmv77xxro0009zvfylgg3byez	30055	EN_MESA	PAGADO	mesa-2	cmv6q725t0007u030var57gzw	rest-polleria-1	t	Tarjeta	3.000000000000000000000000000000	\N	2026-10-13 21:54:26.484	2026-10-13 21:54:26.485	2026-10-13 21:55:13.828
cmv783va4000gzvfyuelltiak	30056	EN_MESA	PAGADO	mesa-2	cmv6q725t0007u030var57gzw	rest-polleria-1	t	Transferencia	328.000000000000000000000000000000	2026-10-13 21:59:15.121	2026-10-13 21:59:41.665	2026-10-13 21:59:03.196	2026-10-13 21:59:59.194
cmv78lkgc001jzvfy12enpucr	30057	EN_MESA	PAGADO	mesa-3	cmv6q71yx0001u0306g1ml1hm	rest-polleria-1	t	Tarjeta	5.000000000000000000000000000000	\N	2026-10-13 22:12:48.97	2026-10-13 22:12:48.972	2026-10-14 11:59:10.343
cmv78vq360006zq9ixyn3d8as	30058	PARA_LLEVAR	PAGADO	\N	cmv6q71yx0001u0306g1ml1hm	rest-polleria-1	t	Efectivo	4.000000000000000000000000000000	2026-10-13 22:20:42.856	2026-10-13 22:20:42.873	2026-10-13 22:20:42.834	2026-10-13 22:20:42.907
cmv78vxys000uzq9itd4dx380	30059	PARA_LLEVAR	PAGADO	\N	cmv6q71yx0001u0306g1ml1hm	rest-polleria-1	t	Efectivo	4.000000000000000000000000000000	2026-10-13 22:20:53.06	2026-10-13 22:20:53.076	2026-10-13 22:20:53.044	2026-10-13 22:20:53.107
cmv6yz1ni0002igvms1m64eqn	30047	EN_MESA	PAGADO	mesa-2	cmv6q71yx0001u0306g1ml1hm	rest-polleria-1	t	Tarjeta	20.000000000000000000000000000000	\N	2026-10-13 17:46:54.765	2026-10-13 17:43:21.629	2026-10-13 17:47:31.389
cmv6z4nw0000q120aaveqgd7p	30053	EN_MESA	PAGADO	mesa-5	cmv6q71yx0001u0306g1ml1hm	rest-polleria-1	t	Transferencia	100.000000000000000000000000000000	2026-10-13 17:47:56.222	2026-10-13 17:48:11.039	2026-10-13 17:47:43.728	2026-10-13 17:48:27.647
cmv6u8lyt0004aj36qilra86i	30015	EN_MESA	PAGADO	mesa-3	cmv6q71yx0001u0306g1ml1hm	rest-polleria-1	t	Transferencia	39.000000000000000000000000000000	\N	2026-10-13 15:30:52.278	2026-10-13 15:30:49.782	2026-10-13 15:30:59.202
cmv6uceq1000maj36213dfu7v	30017	EN_MESA	PAGADO	mesa-2	cmv6q71yx0001u0306g1ml1hm	rest-polleria-1	t	Transferencia	8.000000000000000000000000000000	\N	2026-10-13 15:33:48.595	2026-10-13 15:33:47.017	2026-10-13 15:34:12.073
cmv6ufbtr002haj365sbu3z27	30026	EN_MESA	PAGADO	mesa-2	cmv6q71yx0001u0306g1ml1hm	rest-polleria-1	t	Tarjeta	107.000000000000000000000000000000	\N	2026-10-13 15:36:08.802	2026-10-13 15:36:03.232	2026-10-13 15:37:20.821
cmv6ug8qu003baj36pla2xpet	30029	EN_MESA	PAGADO	mesa-4	cmv6q71yx0001u0306g1ml1hm	rest-polleria-1	t	Transferencia	94.000000000000000000000000000000	\N	2026-10-13 15:36:49.745	2026-10-13 15:36:45.895	2026-10-13 15:37:32.904
cmv6ugcj5003iaj368567r12l	30030	EN_MESA	PAGADO	mesa-5	cmv6q71yx0001u0306g1ml1hm	rest-polleria-1	t	Transferencia	94.000000000000000000000000000000	\N	2026-10-13 15:36:52.005	2026-10-13 15:36:50.801	2026-10-13 15:37:37.986
cmv6ue77o0014aj36dgp568yy	30019	EN_MESA	PAGADO	mesa-8	cmv6q71yx0001u0306g1ml1hm	rest-polleria-1	t	Transferencia	20.000000000000000000000000000000	\N	2026-10-13 15:36:06.277	2026-10-13 15:35:10.596	2026-10-13 15:37:51.911
cmv6uejk4001iaj36mz1vwpkf	30021	EN_MESA	PAGADO	mesa-10	cmv6q71yx0001u0306g1ml1hm	rest-polleria-1	t	Tarjeta	116.000000000000000000000000000000	\N	2026-10-13 15:36:07.333	2026-10-13 15:35:26.596	2026-10-13 15:38:02.01
cmv6uwddp0004d0rd6accgxq6	30032	EN_MESA	PAGADO	mesa-4	cmv6q725t0007u030var57gzw	rest-polleria-1	t	Tarjeta	22.000000000000000000000000000000	\N	2026-10-13 15:49:47.492	2026-10-13 15:49:18.397	2026-10-13 15:50:32.577
cmv6v6dc9000l8ka6a9ryx57e	30037	EN_MESA	PAGADO	mesa-1	cmv6q725t0007u030var57gzw	rest-polleria-1	t	Transferencia	74.000000000000000000000000000000	2026-10-13 15:57:08.591	2026-10-13 15:57:20.936	2026-10-13 15:57:04.906	2026-10-13 15:57:30.274
cmv6v79q6000v8ka6655jqffs	30038	EN_MESA	PAGADO	mesa-9	cmv6q725t0007u030var57gzw	rest-polleria-1	t	Tarjeta	147.000000000000000000000000000000	2026-10-13 15:57:50.649	2026-10-13 15:58:08.25	2026-10-13 15:57:46.879	2026-10-13 15:58:12.355
\.


--
-- Data for Name: Producto; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."Producto" (id, nombre, descripcion, precio, imagen, disponible, "categoriaId", "restauranteId", "requiereCocina") FROM stdin;
prod-combo-broaster	Бизнес-ланч «Лёгкий»	Суп дня + салат + хлеб + чай	18.000000000000000000000000000000	\N	t	cat-combos	rest-polleria-1	t
prod-borsch	Борщ со сметаной	Борщ с говядиной, сметана и зелень	9.000000000000000000000000000000	\N	t	cat-sopas	rest-polleria-1	t
prod-lagman	Лагман	Суп с лапшой, говядиной и овощами	11.000000000000000000000000000000	\N	t	cat-sopas	rest-polleria-1	t
prod-solyanka	Солянка мясная	Сборная мясная солянка с лимоном и маслинами	11.000000000000000000000000000000	\N	t	cat-sopas	rest-polleria-1	t
prod-bulyon	Куриный бульон с лапшой	Домашний бульон, лапша, яйцо	8.000000000000000000000000000000	\N	t	cat-sopas	rest-polleria-1	t
prod-shorpa	Шурпа	Наваристый суп из баранины с овощами	12.000000000000000000000000000000	\N	t	cat-sopas	rest-polleria-1	t
prod-pollo-entero	Бешбармак	Конина/говядина, пласты теста, лук, наваристый бульон	55.000000000000000000000000000000	\N	t	cat-pollos	rest-polleria-1	t
prod-medio-pollo	Плов по-узбекски	Рис, говядина, морковь, нут, чеснок	29.000000000000000000000000000000	\N	t	cat-pollos	rest-polleria-1	t
prod-cuarto-pollo	Котлета по-киевски с пюре	Куриная котлета со сливочным маслом и картофельным пюре	16.000000000000000000000000000000	\N	t	cat-pollos	rest-polleria-1	t
prod-octavo-pollo	Шашлык из курицы (шампур)	Шампур маринованной курицы с луком	10.000000000000000000000000000000	\N	t	cat-pollos	rest-polleria-1	t
prod-pelmeni	Пельмени со сметаной	Домашние пельмени, 12 шт.	14.000000000000000000000000000000	\N	t	cat-pollos	rest-polleria-1	t
prod-manty	Манты (5 шт.)	Манты с мясом и луком, на пару	15.000000000000000000000000000000	\N	t	cat-pollos	rest-polleria-1	t
prod-golubtsy	Голубцы со сметаной	Капустные голубцы с мясом и рисом	13.000000000000000000000000000000	\N	t	cat-pollos	rest-polleria-1	t
prod-stroganov	Бефстроганов с гречкой	Говядина в сливочном соусе, гречневая каша	18.000000000000000000000000000000	\N	t	cat-pollos	rest-polleria-1	t
prod-combo-personal	Бизнес-ланч «Классический»	Салат + суп дня + горячее + компот	22.000000000000000000000000000000	\N	t	cat-combos	rest-polleria-1	t
prod-combo-duo	Сет «Дуэт»	Пельмени + салат + 2 компота	42.000000000000000000000000000000	\N	t	cat-combos	rest-polleria-1	t
prod-combo-familiar	Сет «Семейный»	Бешбармак + салат + выпечка + 4 напитка	65.000000000000000000000000000000	\N	t	cat-combos	rest-polleria-1	t
prod-combo-broaster2	Сет «Праздничный»	Плов + шашлык + салат + 4 компота	52.000000000000000000000000000000	\N	t	cat-combos	rest-polleria-1	t
prod-papas-fritas	Картофель фри	Порция хрустящего картофеля фри	8.000000000000000000000000000000	\N	t	cat-acompanamientos	rest-polleria-1	t
prod-yuca-frita	Картофельное пюре	Нежное пюре со сливочным маслом	8.000000000000000000000000000000	\N	t	cat-acompanamientos	rest-polleria-1	t
prod-ensalada	Салат «Оливье»	Классический салат с колбасой и горошком	5.000000000000000000000000000000	\N	t	cat-acompanamientos	rest-polleria-1	t
prod-arroz	Гречка отварная	Порция рассыпчатой гречки	4.000000000000000000000000000000	\N	t	cat-acompanamientos	rest-polleria-1	t
prod-chaufa-arroz	Макароны по-флотски	Макароны с мясным фаршем и луком	10.000000000000000000000000000000	\N	t	cat-acompanamientos	rest-polleria-1	t
prod-vinegret	Винегрет	Свёкла, картофель, морковь, солёный огурец	5.000000000000000000000000000000	\N	t	cat-acompanamientos	rest-polleria-1	t
prod-caesar	Салат «Цезарь»	Курица, романо, пармезан, сухарики	9.000000000000000000000000000000	\N	t	cat-acompanamientos	rest-polleria-1	t
prod-shuba	Селёдка под шубой	Слоёный салат с сельдью и свёклой	7.000000000000000000000000000000	\N	t	cat-acompanamientos	rest-polleria-1	t
prod-hleb	Хлеб / лепёшка	Порция хлеба или горячей лепёшки	1.000000000000000000000000000000	\N	t	cat-acompanamientos	rest-polleria-1	f
prod-samsa	Самса с говядиной	Слоёная самса из тандыра	5.000000000000000000000000000000	\N	t	cat-postres	rest-polleria-1	t
prod-blini	Блины с творогом	3 блина со сладким творогом и сметаной	8.000000000000000000000000000000	\N	t	cat-postres	rest-polleria-1	t
prod-syrniki	Сырники со сметаной	Творожные сырники, 3 шт.	8.000000000000000000000000000000	\N	t	cat-postres	rest-polleria-1	t
prod-napoleon	Торт «Наполеон» (кусок)	Слоёный торт с заварным кремом	7.000000000000000000000000000000	\N	t	cat-postres	rest-polleria-1	f
prod-chak-chak	Чак-чак	Восточная сладость с мёдом	6.000000000000000000000000000000	\N	t	cat-postres	rest-polleria-1	f
prod-baursaki	Баурсаки (порция)	Жареные пышки к чаю	4.000000000000000000000000000000	\N	t	cat-postres	rest-polleria-1	t
prod-coca-personal	Coca-Cola 0,5 л	500 мл	5.000000000000000000000000000000	\N	t	cat-bebidas	rest-polleria-1	f
prod-coca-grande	Coca-Cola 1,5 л	1,5 литра	10.000000000000000000000000000000	\N	t	cat-bebidas	rest-polleria-1	f
prod-inca-personal	Pepsi 0,5 л	500 мл	5.000000000000000000000000000000	\N	t	cat-bebidas	rest-polleria-1	f
prod-inca-grande	Pepsi 1,5 л	1,5 литра	10.000000000000000000000000000000	\N	t	cat-bebidas	rest-polleria-1	f
prod-agua	Вода минеральная 0,5 л	Газированная или негазированная	3.000000000000000000000000000000	\N	t	cat-bebidas	rest-polleria-1	f
prod-limonada	Лимонад домашний	Большой стакан со льдом	7.000000000000000000000000000000	\N	t	cat-bebidas	rest-polleria-1	f
prod-chicha	Морс клюквенный	Большой стакан	6.000000000000000000000000000000	\N	t	cat-bebidas	rest-polleria-1	f
prod-kompot	Компот из сухофруктов	Стакан 250 мл	3.000000000000000000000000000000	\N	t	cat-bebidas	rest-polleria-1	f
prod-chai-black	Чай чёрный (чайник)	Чайник 500 мл с лимоном	4.000000000000000000000000000000	\N	t	cat-bebidas	rest-polleria-1	f
prod-chai-green	Чай зелёный (чайник)	Чайник 500 мл	4.000000000000000000000000000000	\N	t	cat-bebidas	rest-polleria-1	f
prod-coffee	Кофе американо	200 мл	5.000000000000000000000000000000	\N	t	cat-bebidas	rest-polleria-1	f
prod-ayran	Айран	Стакан 300 мл	4.000000000000000000000000000000	\N	t	cat-bebidas	rest-polleria-1	f
prod-kvas	Квас	Стакан 300 мл	4.000000000000000000000000000000	\N	t	cat-bebidas	rest-polleria-1	f
prod-ketchup	Кетчуп	\N	1.000000000000000000000000000000	\N	t	cat-extras	rest-polleria-1	f
prod-mayonesa	Майонез	\N	1.000000000000000000000000000000	\N	t	cat-extras	rest-polleria-1	f
prod-aji-verde	Сметана	Порция сметаны	2.000000000000000000000000000000	\N	t	cat-extras	rest-polleria-1	f
prod-salsa-criolla	Аджика	Порция аджики	2.000000000000000000000000000000	\N	t	cat-extras	rest-polleria-1	f
prod-salsa-huancaina	Соус чесночный	Порция чесночного соуса	3.000000000000000000000000000000	\N	t	cat-extras	rest-polleria-1	f
\.


--
-- Data for Name: Proveedor; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."Proveedor" (id, nombre, contacto, telefono, email, notas, activo, "restauranteId", "creadoEn") FROM stdin;
cmv78db1v000qzvfy97r9tj5s	Арсен Құлбарақов Hains	Arsen Haienz	87053556544	arsen.haienz@mail.ru	кетчуп-майонез соус поставщик	t	rest-polleria-1	2026-10-13 22:06:23.54
\.


--
-- Data for Name: Recepcion; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."Recepcion" (id, "compraId", "restauranteId", "usuarioId", notas, cerrada, "creadoEn") FROM stdin;
cmv78h8r9000yzvfyrtho397m	cmv78gtox000tzvfyke9udrrn	rest-polleria-1	cmv6q71yx0001u0306g1ml1hm	да да привезли!	f	2026-10-13 22:09:27.19
cmv78kt1z001azvfy638lqxbz	cmv78kjnu0013zvfyigq3uok9	rest-polleria-1	cmv6q71yx0001u0306g1ml1hm	да привезен	f	2026-10-13 22:12:13.463
\.


--
-- Data for Name: RecepcionItem; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."RecepcionItem" (id, "recepcionId", "compraItemId", "insumoId", cantidad, "costoUnitario") FROM stdin;
cmv78h8r9000zzvfyadfo9ppb	cmv78h8r9000yzvfyrtho397m	cmv78gtox000vzvfy9p038esj	insumo-кетчуп	20.000	700.00
cmv78kt1z001bzvfy998uwoq6	cmv78kt1z001azvfy638lqxbz	cmv78kjnu0015zvfyfk2qwlbv	insumo-майонез	9.000	750.00
cmv78kt1z001czvfygwxa73x5	cmv78kt1z001azvfy638lqxbz	cmv78kjnu0016zvfypd9wgjxr	insumo-огурцы	6.000	250.00
cmv78kt1z001dzvfy345qocci	cmv78kt1z001azvfy638lqxbz	cmv78kjnu0017zvfyz9s658bq	insumo-томатная-паста	15.000	900.00
\.


--
-- Data for Name: RegistroActividad; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."RegistroActividad" (id, "restauranteId", "usuarioId", "usuarioNombre", rol, accion, detalle, ref, metodo, ruta, estado, "creadoEn") FROM stdin;
cmv83xmwz0000nv1ofjpq9zo5	rest-polleria-1	user-owner-1	Владелец	SUPERADMIN	sesion.entrada	\N	\N	POST	/api/auth/login	200	2026-10-14 12:50:00.132
cmv79gn7m00008dcjpq9jslx0	rest-polleria-1	user-owner-1	Владелец	SUPERADMIN	sesion.entrada	\N	\N	POST	/api/auth/login	200	2026-10-13 22:36:58.883
cmv79gn8j00018dcj8uotoqp6	rest-polleria-1	user-owner-1	Владелец	SUPERADMIN	restaurante.editar	\N	\N	PUT	/api/restaurante	200	2026-10-13 22:36:58.915
cmv79gn9500028dcjbu855k8b	rest-polleria-1	user-owner-1	Владелец	SUPERADMIN	restaurante.editar	\N	\N	PUT	/api/restaurante	200	2026-10-13 22:36:58.937
cmv79j7em00038dcjyflmggem	rest-polleria-1	user-owner-1	Владелец	SUPERADMIN	sesion.entrada	\N	\N	POST	/api/auth/login	200	2026-10-13 22:38:58.367
cmv79lm8n00048dcjtn1fzmfl	rest-polleria-1	user-owner-1	Владелец	SUPERADMIN	restaurante.editar	\N	\N	PUT	/api/restaurante	200	2026-10-13 22:40:50.903
cmv7a0w6h000016tm3cryczal	rest-polleria-1	user-owner-1	Владелец	SUPERADMIN	restaurante.editar	\N	\N	PUT	/api/restaurante	200	2026-10-13 22:52:43.625
cmv7a13o7000116tmhtrbeq93	rest-polleria-1	user-owner-1	Владелец	SUPERADMIN	restaurante.editar	\N	\N	PUT	/api/restaurante	200	2026-10-13 22:52:53.335
cmv7bfdom000013d728rd0s49	rest-polleria-1	user-owner-1	Владелец	SUPERADMIN	sesion.entrada	\N	\N	POST	/api/auth/login	200	2026-10-13 23:31:59.11
cmv823skf000011xs5fp5d2b3	rest-polleria-1	cmv6q725t0007u030var57gzw	María Cajera	CAJERO	sesion.entrada	\N	\N	POST	/api/auth/login	200	2026-10-14 11:58:48.159
cmv8294kg0000pe3l0jr1u6rs	rest-polleria-1	user-owner-1	Владелец	SUPERADMIN	sesion.entrada	\N	\N	POST	/api/auth/login	200	2026-10-14 12:02:56.993
cmv829amu0001pe3ll54149i5	rest-polleria-1	user-owner-1	Владелец	SUPERADMIN	sesion.entrada	\N	\N	POST	/api/auth/login	200	2026-10-14 12:03:04.854
cmv82aiuo0008pe3lghyonj21	rest-polleria-1	cmv6q723i0005u030l18nmxnh	Juan Cocinero	COCINERO	sesion.entrada	\N	\N	POST	/api/auth/login	200	2026-10-14 12:04:02.161
cmv82auey000dpe3l2tq4qfcn	rest-polleria-1	cmv6q725t0007u030var57gzw	María Cajera	CAJERO	sesion.entrada	\N	\N	POST	/api/auth/login	200	2026-10-14 12:04:17.147
cmv82ho0q000ipe3lpantlqlp	rest-polleria-1	user-owner-1	Владелец	SUPERADMIN	sesion.entrada	\N	\N	POST	/api/auth/login	200	2026-10-14 12:09:35.45
cmv82lq7r0000irs5s2dn2imm	rest-polleria-1	user-owner-1	Владелец	SUPERADMIN	sesion.entrada	\N	\N	POST	/api/auth/login	200	2026-10-14 12:12:44.919
cmv82lqa20001irs56skrzy2h	rest-polleria-1	cmv6q71yx0001u0306g1ml1hm	Administrador	ADMIN	sesion.entrada	\N	\N	POST	/api/auth/login	200	2026-10-14 12:12:45.003
cmv82lqcd0002irs5oao572kr	rest-polleria-1	cmv6q725t0007u030var57gzw	María Cajera	CAJERO	sesion.entrada	\N	\N	POST	/api/auth/login	200	2026-10-14 12:12:45.085
cmv82m1qx0006irs5o5s2vtco	rest-polleria-1	user-owner-1	Владелец	SUPERADMIN	sesion.entrada	\N	\N	POST	/api/auth/login	200	2026-10-14 12:12:59.865
cmv8302ga0000o07m780ouzmb	rest-polleria-1	cmv6q72170003u030qntoplz8	Carlos Mesero	MESERO	sesion.entrada	\N	\N	POST	/api/auth/login	200	2026-10-14 12:23:53.963
cmv83dz1h00001kj52hdxjdwy	rest-polleria-1	user-owner-1	Владелец	SUPERADMIN	sesion.entrada	\N	\N	POST	/api/auth/login	200	2026-10-14 12:34:42.725
cmv83eugn0000wcbot086wv66	rest-polleria-1	user-owner-1	Владелец	SUPERADMIN	sesion.entrada	\N	\N	POST	/api/auth/login	200	2026-10-14 12:35:23.447
cmv83fd84000gwcbo6u9y9ot1	rest-polleria-1	user-owner-1	Владелец	SUPERADMIN	sesion.entrada	\N	\N	POST	/api/auth/login	200	2026-10-14 12:35:47.764
cmv83h2oa000twcbo96ryeise	rest-polleria-1	user-owner-1	Владелец	SUPERADMIN	sesion.entrada	\N	\N	POST	/api/auth/login	200	2026-10-14 12:37:07.402
cmv83lhnh000011lbtl1lp08y	rest-polleria-1	user-owner-1	Владелец	SUPERADMIN	sesion.entrada	\N	\N	POST	/api/auth/login	200	2026-10-14 12:40:33.437
cmv83lhpr000111lb13uq96ea	rest-polleria-1	cmv6q71yx0001u0306g1ml1hm	Administrador	ADMIN	sesion.entrada	\N	\N	POST	/api/auth/login	200	2026-10-14 12:40:33.52
cmv83lhrz000211lb8w3fcf5r	rest-polleria-1	cmv6q725t0007u030var57gzw	María Cajera	CAJERO	sesion.entrada	\N	\N	POST	/api/auth/login	200	2026-10-14 12:40:33.599
cmv83lhuf000311lbhoegtudr	rest-polleria-1	cmv6q72170003u030qntoplz8	Carlos Mesero	MESERO	sesion.entrada	\N	\N	POST	/api/auth/login	200	2026-10-14 12:40:33.687
cmv83lhwo000411lb3al1s8rs	rest-polleria-1	cmv6q723i0005u030l18nmxnh	Juan Cocinero	COCINERO	sesion.entrada	\N	\N	POST	/api/auth/login	200	2026-10-14 12:40:33.768
cmv83qa9t000099yek999fg2s	rest-polleria-1	user-owner-1	Владелец	SUPERADMIN	sesion.entrada	\N	\N	POST	/api/auth/login	200	2026-10-14 12:44:17.153
cmv83qac9000199ye7scuqjq8	rest-polleria-1	cmv6q723i0005u030l18nmxnh	Juan Cocinero	COCINERO	sesion.entrada	\N	\N	POST	/api/auth/login	200	2026-10-14 12:44:17.242
cmv83qaf0000299yeoewko9jy	rest-polleria-1	cmv6q72170003u030qntoplz8	Carlos Mesero	MESERO	sesion.entrada	\N	\N	POST	/api/auth/login	200	2026-10-14 12:44:17.34
cmv83qah8000399yeukp9g9el	rest-polleria-1	cmv6q725t0007u030var57gzw	María Cajera	CAJERO	sesion.entrada	\N	\N	POST	/api/auth/login	200	2026-10-14 12:44:17.42
cmv83qaul002099yefkafnxji	rest-polleria-1	user-owner-1	Владелец	SUPERADMIN	categoria.crear	\N	\N	POST	/api/menu/categorias	201	2026-10-14 12:44:17.902
cmv83sir20000fx8cdnxlxa54	rest-polleria-1	user-owner-1	Владелец	SUPERADMIN	sesion.entrada	\N	\N	POST	/api/auth/login	200	2026-10-14 12:46:01.454
cmv83sitb0001fx8cnqj6dkmv	rest-polleria-1	cmv6q723i0005u030l18nmxnh	Juan Cocinero	COCINERO	sesion.entrada	\N	\N	POST	/api/auth/login	200	2026-10-14 12:46:01.535
cmv83sivj0002fx8cyedzjwiy	rest-polleria-1	cmv6q72170003u030qntoplz8	Carlos Mesero	MESERO	sesion.entrada	\N	\N	POST	/api/auth/login	200	2026-10-14 12:46:01.615
cmv83sixu0003fx8c6w18qla5	rest-polleria-1	cmv6q725t0007u030var57gzw	María Cajera	CAJERO	sesion.entrada	\N	\N	POST	/api/auth/login	200	2026-10-14 12:46:01.698
cmv83sj8y001lfx8cnql69oyj	rest-polleria-1	user-owner-1	Владелец	SUPERADMIN	categoria.crear	\N	\N	POST	/api/menu/categorias	201	2026-10-14 12:46:02.099
\.


--
-- Data for Name: Restaurante; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."Restaurante" (id, nombre, direccion, telefono, logo, "timerMesa", "creadoEn", "pieTicket", "qrTicket", moneda, "qrPago") FROM stdin;
rest-polleria-1	Aisultan	Рыскулбекова 81	+77756131326	\N	45	2026-10-13 13:37:38.652	Спасибо за визит! Приходите еще! 	korgenshop,kz	KZT	\N
\.


--
-- Data for Name: TrabajoImpresion; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."TrabajoImpresion" (id, "restauranteId", "impresoraId", tipo, referencia, ok, error, ms, "usuarioId", "creadoEn") FROM stdin;
\.


--
-- Data for Name: Usuario; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."Usuario" (id, nombre, email, "passwordHash", rol, activo, "restauranteId", "creadoEn") FROM stdin;
cmv6q725t0007u030var57gzw	María Cajera	caja@aisultan.com	$2a$10$ClqKj2A8FUZsS/jhQ8KQsOJLl8NMiIst2fRmEenAoZQ1G8oKtIEf.	CAJERO	t	rest-polleria-1	2026-10-13 13:37:38.994
user-owner-1	Владелец	owner@aisultan.com	$2a$10$TdcF71N1syUlQXTj32lzx.6h7P351UUCDvjvXf5IcUW8Y.BTGwFbG	SUPERADMIN	t	rest-polleria-1	2026-10-13 22:20:35.527
cmv6q71yx0001u0306g1ml1hm	Administrador	admin@aisultan.com	$2a$10$EPkjd3ZordIlaKjkc6oMSOEBdoPDl.A66vVUTG4TDyJqBpCZn.tDq	ADMIN	t	rest-polleria-1	2026-10-13 13:37:38.745
cmv6q72170003u030qntoplz8	Carlos Mesero	mesero@aisultan.com	$2a$10$OrcWr6j9B7puiBBK.9LdYuef8UquKnM9M9rnefoP86G2hGrvUpk32	MESERO	t	rest-polleria-1	2026-10-13 13:37:38.827
cmv6q723i0005u030l18nmxnh	Juan Cocinero	cocina@aisultan.com	$2a$10$0HlYKlFMXs3GroWZ7cFHieibsDVe/orRIidZrtuwN0bNmhqjN3wUm	COCINERO	t	rest-polleria-1	2026-10-13 13:37:38.911
\.


--
-- Data for Name: _prisma_migrations; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public._prisma_migrations (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count) FROM stdin;
557b935b-21b4-48cd-a7c0-703d3e9566cc	58a5edab267cf053e1dc9fab688aece179b4245e56dbc42fa43928910bd7beee	2026-10-13 13:35:20.273642+00	20260422092019_init	\N	\N	2026-10-13 13:35:20.184678+00	1
d2f6aa7c-16d6-4bd7-8d65-47829bcfff22	7bcf85320b258ad4ffda819d7515e4eaabd36d43cb270dcb2a42d777d646c30a	2026-10-13 13:37:35.335952+00	20260501000000_add_servido_requiere_cocina	\N	\N	2026-10-13 13:37:35.324711+00	1
35f5884d-93d9-4768-b989-0efb06ceff71	1baa72f6ad9feaa54f3ee773afe4a408314f9dd29763d749a8b4ade0aee9a1db	2026-10-13 15:15:58.316904+00	20260601000000_add_indexes	\N	\N	2026-10-13 15:15:57.908442+00	1
68a704af-10c9-4f3e-9eed-1fe48af02c9c	6e18a9822985d7c1f73ff35484a3511276b54a01078ba33561c10c66a1b82b08	2026-10-13 16:20:15.207471+00	20260602000000_compras_almacen_impresion	\N	\N	2026-10-13 16:20:15.007632+00	1
a49f2581-6885-4669-b286-49cc3796c409	3674e62d8fcce3ddd03271775f9917962e217d00f7981d23272a95f48f60f088	2026-10-13 16:37:28.90411+00	20260603000000_impresora_auto	\N	\N	2026-10-13 16:37:28.88937+00	1
773f1264-658b-4662-b311-bc76ab4b03ca	228c155131cd2dbdbb396c85552161f06746a99c15da0ef6f2328f3aeb2258e4	2026-10-13 16:54:02.950202+00	20260604000000_qr_ticket	\N	\N	2026-10-13 16:54:02.937805+00	1
36d6affb-9a44-427b-a5f4-7d952fd4c3aa	1f56f49e9be6c6f44145ac9e96836a818191df3e7c0d5b592963323ef15d703a	2026-10-13 22:20:01.737291+00	20260605000000_rol_superadmin	\N	\N	2026-10-13 22:20:01.717804+00	1
bfeb0020-b643-47a6-95b0-540b273ae617	3185683d487d044eb3d391abb8486cb05eeb6c581363cc1e6dfb0c2cbea4b3cc	2026-10-13 22:20:01.797366+00	20260605000100_registro_actividad	\N	\N	2026-10-13 22:20:01.739028+00	1
af5d5fcf-b372-4023-b5de-b4ca8cb4e179	5537c9725f554a01d5a32a2fb49917e3b8a8e304742d007ee79e4326858783ac	2026-10-14 12:12:27.116933+00	20260606000000_moneda_qr_pago	\N	\N	2026-10-14 12:12:27.096818+00	1
\.


--
-- Name: Compra_numero_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public."Compra_numero_seq"', 109, true);


--
-- Name: Pedido_numero_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public."Pedido_numero_seq"', 30077, true);


--
-- Name: Categoria Categoria_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Categoria"
    ADD CONSTRAINT "Categoria_pkey" PRIMARY KEY (id);


--
-- Name: CompraItem CompraItem_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."CompraItem"
    ADD CONSTRAINT "CompraItem_pkey" PRIMARY KEY (id);


--
-- Name: Compra Compra_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Compra"
    ADD CONSTRAINT "Compra_pkey" PRIMARY KEY (id);


--
-- Name: Impresora Impresora_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Impresora"
    ADD CONSTRAINT "Impresora_pkey" PRIMARY KEY (id);


--
-- Name: Insumo Insumo_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Insumo"
    ADD CONSTRAINT "Insumo_pkey" PRIMARY KEY (id);


--
-- Name: ItemPedido ItemPedido_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ItemPedido"
    ADD CONSTRAINT "ItemPedido_pkey" PRIMARY KEY (id);


--
-- Name: Mesa Mesa_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Mesa"
    ADD CONSTRAINT "Mesa_pkey" PRIMARY KEY (id);


--
-- Name: MovimientoInventario MovimientoInventario_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."MovimientoInventario"
    ADD CONSTRAINT "MovimientoInventario_pkey" PRIMARY KEY (id);


--
-- Name: OperacionIdem OperacionIdem_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."OperacionIdem"
    ADD CONSTRAINT "OperacionIdem_pkey" PRIMARY KEY (clave);


--
-- Name: Pedido Pedido_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Pedido"
    ADD CONSTRAINT "Pedido_pkey" PRIMARY KEY (id);


--
-- Name: Producto Producto_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Producto"
    ADD CONSTRAINT "Producto_pkey" PRIMARY KEY (id);


--
-- Name: Proveedor Proveedor_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Proveedor"
    ADD CONSTRAINT "Proveedor_pkey" PRIMARY KEY (id);


--
-- Name: RecepcionItem RecepcionItem_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."RecepcionItem"
    ADD CONSTRAINT "RecepcionItem_pkey" PRIMARY KEY (id);


--
-- Name: Recepcion Recepcion_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Recepcion"
    ADD CONSTRAINT "Recepcion_pkey" PRIMARY KEY (id);


--
-- Name: RegistroActividad RegistroActividad_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."RegistroActividad"
    ADD CONSTRAINT "RegistroActividad_pkey" PRIMARY KEY (id);


--
-- Name: Restaurante Restaurante_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Restaurante"
    ADD CONSTRAINT "Restaurante_pkey" PRIMARY KEY (id);


--
-- Name: TrabajoImpresion TrabajoImpresion_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."TrabajoImpresion"
    ADD CONSTRAINT "TrabajoImpresion_pkey" PRIMARY KEY (id);


--
-- Name: Usuario Usuario_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Usuario"
    ADD CONSTRAINT "Usuario_pkey" PRIMARY KEY (id);


--
-- Name: _prisma_migrations _prisma_migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public._prisma_migrations
    ADD CONSTRAINT _prisma_migrations_pkey PRIMARY KEY (id);


--
-- Name: Categoria_restauranteId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Categoria_restauranteId_idx" ON public."Categoria" USING btree ("restauranteId");


--
-- Name: CompraItem_compraId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "CompraItem_compraId_idx" ON public."CompraItem" USING btree ("compraId");


--
-- Name: CompraItem_insumoId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "CompraItem_insumoId_idx" ON public."CompraItem" USING btree ("insumoId");


--
-- Name: Compra_proveedorId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Compra_proveedorId_idx" ON public."Compra" USING btree ("proveedorId");


--
-- Name: Compra_restauranteId_creadoEn_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Compra_restauranteId_creadoEn_idx" ON public."Compra" USING btree ("restauranteId", "creadoEn");


--
-- Name: Compra_restauranteId_estado_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Compra_restauranteId_estado_idx" ON public."Compra" USING btree ("restauranteId", estado);


--
-- Name: Impresora_restauranteId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Impresora_restauranteId_idx" ON public."Impresora" USING btree ("restauranteId");


--
-- Name: Insumo_restauranteId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Insumo_restauranteId_idx" ON public."Insumo" USING btree ("restauranteId");


--
-- Name: ItemPedido_pedidoId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ItemPedido_pedidoId_idx" ON public."ItemPedido" USING btree ("pedidoId");


--
-- Name: ItemPedido_productoId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ItemPedido_productoId_idx" ON public."ItemPedido" USING btree ("productoId");


--
-- Name: Mesa_restauranteId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Mesa_restauranteId_idx" ON public."Mesa" USING btree ("restauranteId");


--
-- Name: MovimientoInventario_compraId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "MovimientoInventario_compraId_idx" ON public."MovimientoInventario" USING btree ("compraId");


--
-- Name: MovimientoInventario_insumoId_creadoEn_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "MovimientoInventario_insumoId_creadoEn_idx" ON public."MovimientoInventario" USING btree ("insumoId", "creadoEn");


--
-- Name: MovimientoInventario_restauranteId_creadoEn_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "MovimientoInventario_restauranteId_creadoEn_idx" ON public."MovimientoInventario" USING btree ("restauranteId", "creadoEn");


--
-- Name: OperacionIdem_creadoEn_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "OperacionIdem_creadoEn_idx" ON public."OperacionIdem" USING btree ("creadoEn");


--
-- Name: Pedido_mesaId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Pedido_mesaId_idx" ON public."Pedido" USING btree ("mesaId");


--
-- Name: Pedido_meseroId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Pedido_meseroId_idx" ON public."Pedido" USING btree ("meseroId");


--
-- Name: Pedido_restauranteId_creadoEn_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Pedido_restauranteId_creadoEn_idx" ON public."Pedido" USING btree ("restauranteId", "creadoEn");


--
-- Name: Pedido_restauranteId_estado_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Pedido_restauranteId_estado_idx" ON public."Pedido" USING btree ("restauranteId", estado);


--
-- Name: Producto_categoriaId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Producto_categoriaId_idx" ON public."Producto" USING btree ("categoriaId");


--
-- Name: Producto_restauranteId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Producto_restauranteId_idx" ON public."Producto" USING btree ("restauranteId");


--
-- Name: Proveedor_restauranteId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Proveedor_restauranteId_idx" ON public."Proveedor" USING btree ("restauranteId");


--
-- Name: RecepcionItem_recepcionId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "RecepcionItem_recepcionId_idx" ON public."RecepcionItem" USING btree ("recepcionId");


--
-- Name: Recepcion_compraId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Recepcion_compraId_idx" ON public."Recepcion" USING btree ("compraId");


--
-- Name: Recepcion_restauranteId_creadoEn_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Recepcion_restauranteId_creadoEn_idx" ON public."Recepcion" USING btree ("restauranteId", "creadoEn");


--
-- Name: RegistroActividad_restauranteId_creadoEn_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "RegistroActividad_restauranteId_creadoEn_idx" ON public."RegistroActividad" USING btree ("restauranteId", "creadoEn");


--
-- Name: RegistroActividad_usuarioId_creadoEn_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "RegistroActividad_usuarioId_creadoEn_idx" ON public."RegistroActividad" USING btree ("usuarioId", "creadoEn");


--
-- Name: TrabajoImpresion_restauranteId_creadoEn_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "TrabajoImpresion_restauranteId_creadoEn_idx" ON public."TrabajoImpresion" USING btree ("restauranteId", "creadoEn");


--
-- Name: Usuario_email_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Usuario_email_key" ON public."Usuario" USING btree (email);


--
-- Name: Usuario_restauranteId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Usuario_restauranteId_idx" ON public."Usuario" USING btree ("restauranteId");


--
-- Name: Categoria Categoria_restauranteId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Categoria"
    ADD CONSTRAINT "Categoria_restauranteId_fkey" FOREIGN KEY ("restauranteId") REFERENCES public."Restaurante"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: CompraItem CompraItem_compraId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."CompraItem"
    ADD CONSTRAINT "CompraItem_compraId_fkey" FOREIGN KEY ("compraId") REFERENCES public."Compra"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: CompraItem CompraItem_insumoId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."CompraItem"
    ADD CONSTRAINT "CompraItem_insumoId_fkey" FOREIGN KEY ("insumoId") REFERENCES public."Insumo"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Compra Compra_proveedorId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Compra"
    ADD CONSTRAINT "Compra_proveedorId_fkey" FOREIGN KEY ("proveedorId") REFERENCES public."Proveedor"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Compra Compra_restauranteId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Compra"
    ADD CONSTRAINT "Compra_restauranteId_fkey" FOREIGN KEY ("restauranteId") REFERENCES public."Restaurante"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Impresora Impresora_restauranteId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Impresora"
    ADD CONSTRAINT "Impresora_restauranteId_fkey" FOREIGN KEY ("restauranteId") REFERENCES public."Restaurante"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Insumo Insumo_restauranteId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Insumo"
    ADD CONSTRAINT "Insumo_restauranteId_fkey" FOREIGN KEY ("restauranteId") REFERENCES public."Restaurante"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: ItemPedido ItemPedido_pedidoId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ItemPedido"
    ADD CONSTRAINT "ItemPedido_pedidoId_fkey" FOREIGN KEY ("pedidoId") REFERENCES public."Pedido"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: ItemPedido ItemPedido_productoId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ItemPedido"
    ADD CONSTRAINT "ItemPedido_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES public."Producto"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Mesa Mesa_restauranteId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Mesa"
    ADD CONSTRAINT "Mesa_restauranteId_fkey" FOREIGN KEY ("restauranteId") REFERENCES public."Restaurante"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: MovimientoInventario MovimientoInventario_insumoId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."MovimientoInventario"
    ADD CONSTRAINT "MovimientoInventario_insumoId_fkey" FOREIGN KEY ("insumoId") REFERENCES public."Insumo"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Pedido Pedido_mesaId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Pedido"
    ADD CONSTRAINT "Pedido_mesaId_fkey" FOREIGN KEY ("mesaId") REFERENCES public."Mesa"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Pedido Pedido_meseroId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Pedido"
    ADD CONSTRAINT "Pedido_meseroId_fkey" FOREIGN KEY ("meseroId") REFERENCES public."Usuario"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Pedido Pedido_restauranteId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Pedido"
    ADD CONSTRAINT "Pedido_restauranteId_fkey" FOREIGN KEY ("restauranteId") REFERENCES public."Restaurante"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Producto Producto_categoriaId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Producto"
    ADD CONSTRAINT "Producto_categoriaId_fkey" FOREIGN KEY ("categoriaId") REFERENCES public."Categoria"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Producto Producto_restauranteId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Producto"
    ADD CONSTRAINT "Producto_restauranteId_fkey" FOREIGN KEY ("restauranteId") REFERENCES public."Restaurante"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Proveedor Proveedor_restauranteId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Proveedor"
    ADD CONSTRAINT "Proveedor_restauranteId_fkey" FOREIGN KEY ("restauranteId") REFERENCES public."Restaurante"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: RecepcionItem RecepcionItem_recepcionId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."RecepcionItem"
    ADD CONSTRAINT "RecepcionItem_recepcionId_fkey" FOREIGN KEY ("recepcionId") REFERENCES public."Recepcion"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Recepcion Recepcion_compraId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Recepcion"
    ADD CONSTRAINT "Recepcion_compraId_fkey" FOREIGN KEY ("compraId") REFERENCES public."Compra"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: TrabajoImpresion TrabajoImpresion_impresoraId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."TrabajoImpresion"
    ADD CONSTRAINT "TrabajoImpresion_impresoraId_fkey" FOREIGN KEY ("impresoraId") REFERENCES public."Impresora"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Usuario Usuario_restauranteId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Usuario"
    ADD CONSTRAINT "Usuario_restauranteId_fkey" FOREIGN KEY ("restauranteId") REFERENCES public."Restaurante"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- PostgreSQL database dump complete
--

\unrestrict KmAvMbfCo2ojVpwK1y3bmbUumWcaqb3SuDbsz3TJf1L4aTRW4xEpYlRNSYrUJFY

