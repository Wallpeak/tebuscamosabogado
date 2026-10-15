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
