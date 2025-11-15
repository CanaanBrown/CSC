-- MySQL dump 10.13  Distrib 8.0.43, for Win64 (x86_64)
--
-- Host: 127.0.0.1    Database: crimson_collectibles
-- ------------------------------------------------------
-- Server version	5.5.5-10.4.32-MariaDB

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `customer_purchase_transactions`
--

DROP TABLE IF EXISTS `customer_purchase_transactions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `customer_purchase_transactions` (
  `transaction_id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `customer_id` int(10) unsigned NOT NULL,
  `employee_id` int(10) unsigned NOT NULL,
  `transaction_date` datetime NOT NULL DEFAULT current_timestamp(),
  `subtotal` decimal(10,2) NOT NULL DEFAULT 0.00,
  `tax` decimal(10,2) NOT NULL DEFAULT 0.00,
  `total` decimal(10,2) NOT NULL DEFAULT 0.00,
  PRIMARY KEY (`transaction_id`),
  KEY `fk_tx_customer` (`customer_id`),
  KEY `fk_tx_employee` (`employee_id`),
  KEY `idx_tx_date` (`transaction_date`),
  CONSTRAINT `fk_tx_customer` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`customer_id`) ON UPDATE CASCADE,
  CONSTRAINT `fk_tx_employee` FOREIGN KEY (`employee_id`) REFERENCES `employees` (`employee_id`) ON UPDATE CASCADE,
  CONSTRAINT `CONSTRAINT_1` CHECK (`subtotal` >= 0),
  CONSTRAINT `CONSTRAINT_2` CHECK (`tax` >= 0),
  CONSTRAINT `CONSTRAINT_3` CHECK (`total` >= 0)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `customer_purchase_transactions`
--

LOCK TABLES `customer_purchase_transactions` WRITE;
/*!40000 ALTER TABLE `customer_purchase_transactions` DISABLE KEYS */;
INSERT INTO `customer_purchase_transactions` VALUES (1,1,1,'2025-11-07 07:44:31',0.00,0.00,0.00),(2,1,1,'2025-11-07 07:51:20',0.00,0.00,0.00),(3,1,1,'2025-11-07 07:51:25',0.00,0.00,0.00);
/*!40000 ALTER TABLE `customer_purchase_transactions` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `customers`
--

DROP TABLE IF EXISTS `customers`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `customers` (
  `customer_id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `first_name` varchar(50) NOT NULL,
  `last_name` varchar(50) NOT NULL,
  `email` varchar(120) DEFAULT NULL,
  `phone` varchar(25) DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`customer_id`),
  UNIQUE KEY `uq_customers_email` (`email`)
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `customers`
--

LOCK TABLES `customers` WRITE;
/*!40000 ALTER TABLE `customers` DISABLE KEYS */;
INSERT INTO `customers` VALUES (1,'Cassie','M','cassie@example.com','555-1111','2025-11-07 07:42:51'),(2,'Derek','J','derek@example.com','555-2222','2025-11-07 07:42:51'),(3,'Cassie','Morgan','cassie@demo.com','555-1000','2025-11-07 07:50:57'),(4,'Derek','Jenkins','derek@demo.com','555-1001','2025-11-07 07:50:57'),(5,'Rin','Fang','rin@demo.com','555-1002','2025-11-07 07:50:57');
/*!40000 ALTER TABLE `customers` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `employees`
--

DROP TABLE IF EXISTS `employees`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `employees` (
  `employee_id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `first_name` varchar(50) NOT NULL,
  `last_name` varchar(50) NOT NULL,
  `role` varchar(40) DEFAULT NULL,
  `hire_date` date DEFAULT NULL,
  PRIMARY KEY (`employee_id`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `employees`
--

LOCK TABLES `employees` WRITE;
/*!40000 ALTER TABLE `employees` DISABLE KEYS */;
INSERT INTO `employees` VALUES (1,'Noah','Davis','Clerk','2023-08-15'),(2,'Ava','Lee','Manager','2022-03-02'),(3,'Noah','Davis','Clerk','2023-08-15'),(4,'Ava','Lee','Manager','2022-03-02');
/*!40000 ALTER TABLE `employees` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `products`
--

DROP TABLE IF EXISTS `products`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `products` (
  `product_id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(120) NOT NULL,
  `category` varchar(60) NOT NULL,
  `sport` varchar(40) NOT NULL,
  `unit_price` decimal(10,2) NOT NULL,
  `stock_qty` int(11) NOT NULL DEFAULT 0,
  `active` tinyint(1) NOT NULL DEFAULT 1,
  PRIMARY KEY (`product_id`),
  KEY `idx_products_category` (`category`),
  KEY `idx_products_sport` (`sport`),
  CONSTRAINT `CONSTRAINT_1` CHECK (`unit_price` >= 0),
  CONSTRAINT `CONSTRAINT_2` CHECK (`stock_qty` >= 0),
  CONSTRAINT `CONSTRAINT_3` CHECK (`active` in (0,1))
) ENGINE=InnoDB AUTO_INCREMENT=8 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `products`
--

LOCK TABLES `products` WRITE;
/*!40000 ALTER TABLE `products` DISABLE KEYS */;
INSERT INTO `products` VALUES (1,'Zion Rookie Card','Trading Card','Basketball',199.99,3,1),(2,'UA Crimson Tee','T-shirt','Football',24.99,46,1),(3,'Signed Baseball','Memorabilia','Baseball',149.00,10,1),(4,'Zion Rookie Card','Trading Card','Basketball',199.99,5,1),(5,'UA Crimson Tee','T-shirt','Football',24.99,50,1),(6,'Signed Baseball','Memorabilia','Baseball',149.00,10,1),(7,'Retired Jersey','Apparel','Basketball',89.00,0,1);
/*!40000 ALTER TABLE `products` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `transaction_details`
--

DROP TABLE IF EXISTS `transaction_details`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `transaction_details` (
  `transaction_id` int(10) unsigned NOT NULL,
  `line_no` int(11) NOT NULL,
  `product_id` int(10) unsigned NOT NULL,
  `qty` int(11) NOT NULL,
  `unit_price` decimal(10,2) NOT NULL,
  `line_total` decimal(10,2) NOT NULL,
  PRIMARY KEY (`transaction_id`,`line_no`),
  KEY `idx_txd_product` (`product_id`),
  CONSTRAINT `fk_txd_product` FOREIGN KEY (`product_id`) REFERENCES `products` (`product_id`) ON UPDATE CASCADE,
  CONSTRAINT `fk_txd_tx` FOREIGN KEY (`transaction_id`) REFERENCES `customer_purchase_transactions` (`transaction_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `CONSTRAINT_1` CHECK (`qty` > 0),
  CONSTRAINT `CONSTRAINT_2` CHECK (`unit_price` >= 0),
  CONSTRAINT `CONSTRAINT_3` CHECK (`line_total` >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `transaction_details`
--

LOCK TABLES `transaction_details` WRITE;
/*!40000 ALTER TABLE `transaction_details` DISABLE KEYS */;
INSERT INTO `transaction_details` VALUES (1,1,1,1,199.99,199.99),(1,2,2,2,24.99,49.98),(3,1,1,1,199.99,199.99),(3,2,2,2,24.99,49.98);
/*!40000 ALTER TABLE `transaction_details` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Temporary view structure for view `v_order_summary`
--

DROP TABLE IF EXISTS `v_order_summary`;
/*!50001 DROP VIEW IF EXISTS `v_order_summary`*/;
SET @saved_cs_client     = @@character_set_client;
/*!50503 SET character_set_client = utf8mb4 */;
/*!50001 CREATE VIEW `v_order_summary` AS SELECT 
 1 AS `transaction_id`,
 1 AS `transaction_date`,
 1 AS `customer_id`,
 1 AS `customer_name`,
 1 AS `employee_id`,
 1 AS `employee_name`,
 1 AS `subtotal`,
 1 AS `tax`,
 1 AS `total`*/;
SET character_set_client = @saved_cs_client;

--
-- Temporary view structure for view `v_product_sales`
--

DROP TABLE IF EXISTS `v_product_sales`;
/*!50001 DROP VIEW IF EXISTS `v_product_sales`*/;
SET @saved_cs_client     = @@character_set_client;
/*!50503 SET character_set_client = utf8mb4 */;
/*!50001 CREATE VIEW `v_product_sales` AS SELECT 
 1 AS `product_id`,
 1 AS `name`,
 1 AS `category`,
 1 AS `sport`,
 1 AS `units_sold`,
 1 AS `revenue`*/;
SET character_set_client = @saved_cs_client;

--
-- Final view structure for view `v_order_summary`
--

/*!50001 DROP VIEW IF EXISTS `v_order_summary`*/;
/*!50001 SET @saved_cs_client          = @@character_set_client */;
/*!50001 SET @saved_cs_results         = @@character_set_results */;
/*!50001 SET @saved_col_connection     = @@collation_connection */;
/*!50001 SET character_set_client      = utf8mb4 */;
/*!50001 SET character_set_results     = utf8mb4 */;
/*!50001 SET collation_connection      = utf8mb4_general_ci */;
/*!50001 CREATE ALGORITHM=UNDEFINED */
/*!50013 DEFINER=`root`@`localhost` SQL SECURITY DEFINER */
/*!50001 VIEW `v_order_summary` AS select `t`.`transaction_id` AS `transaction_id`,`t`.`transaction_date` AS `transaction_date`,`t`.`customer_id` AS `customer_id`,concat(`c`.`first_name`,' ',`c`.`last_name`) AS `customer_name`,`t`.`employee_id` AS `employee_id`,concat(`e`.`first_name`,' ',`e`.`last_name`) AS `employee_name`,`t`.`subtotal` AS `subtotal`,`t`.`tax` AS `tax`,`t`.`total` AS `total` from ((`customer_purchase_transactions` `t` join `customers` `c` on(`c`.`customer_id` = `t`.`customer_id`)) join `employees` `e` on(`e`.`employee_id` = `t`.`employee_id`)) */;
/*!50001 SET character_set_client      = @saved_cs_client */;
/*!50001 SET character_set_results     = @saved_cs_results */;
/*!50001 SET collation_connection      = @saved_col_connection */;

--
-- Final view structure for view `v_product_sales`
--

/*!50001 DROP VIEW IF EXISTS `v_product_sales`*/;
/*!50001 SET @saved_cs_client          = @@character_set_client */;
/*!50001 SET @saved_cs_results         = @@character_set_results */;
/*!50001 SET @saved_col_connection     = @@collation_connection */;
/*!50001 SET character_set_client      = utf8mb4 */;
/*!50001 SET character_set_results     = utf8mb4 */;
/*!50001 SET collation_connection      = utf8mb4_general_ci */;
/*!50001 CREATE ALGORITHM=UNDEFINED */
/*!50013 DEFINER=`root`@`localhost` SQL SECURITY DEFINER */
/*!50001 VIEW `v_product_sales` AS select `p`.`product_id` AS `product_id`,`p`.`name` AS `name`,`p`.`category` AS `category`,`p`.`sport` AS `sport`,coalesce(sum(`td`.`qty`),0) AS `units_sold`,coalesce(sum(`td`.`line_total`),0) AS `revenue` from (`products` `p` left join `transaction_details` `td` on(`td`.`product_id` = `p`.`product_id`)) group by `p`.`product_id`,`p`.`name`,`p`.`category`,`p`.`sport` */;
/*!50001 SET character_set_client      = @saved_cs_client */;
/*!50001 SET character_set_results     = @saved_cs_results */;
/*!50001 SET collation_connection      = @saved_col_connection */;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2025-11-07  8:10:57

