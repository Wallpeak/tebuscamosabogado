CREATE TABLE `leads` (
	`id` int AUTO_INCREMENT NOT NULL,
	`nombre` varchar(255) NOT NULL,
	`telefono` varchar(20) NOT NULL,
	`email` varchar(320) NOT NULL,
	`tipoCliente` enum('particular','empresa') NOT NULL,
	`especialidad` varchar(100) NOT NULL,
	`descripcion` text NOT NULL,
	`presupuesto` varchar(50),
	`estado` enum('nuevo','en_proceso','cerrado') NOT NULL DEFAULT 'nuevo',
	`fechaRecepcion` timestamp NOT NULL DEFAULT (now()),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `leads_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `paginasLegales` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tipo` enum('aviso_legal','privacidad','cookies') NOT NULL,
	`contenido` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `paginasLegales_id` PRIMARY KEY(`id`),
	CONSTRAINT `paginasLegales_tipo_unique` UNIQUE(`tipo`)
);
--> statement-breakpoint
CREATE TABLE `testimonios` (
	`id` int AUTO_INCREMENT NOT NULL,
	`nombre` varchar(255) NOT NULL,
	`ciudad` varchar(100) NOT NULL,
	`tipoCaso` varchar(100) NOT NULL,
	`contenido` text NOT NULL,
	`destacado` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `testimonios_id` PRIMARY KEY(`id`)
);
