FROM php:8.2-apache

# Instalar dependencias del sistema y extensiones PHP
RUN apt-get update && apt-get install -y \
    libzip-dev \
    unzip \
    libpq-dev \
    && docker-php-ext-install zip pdo pdo_pgsql

# Habilitar mod_rewrite
RUN a2enmod rewrite

# Configurar el DocumentRoot de Apache
RUN sed -i 's|/var/www/html|${APACHE_DOCUMENT_ROOT}|g' /etc/apache2/sites-available/000-default.conf
RUN sed -i 's|/var/www/html|${APACHE_DOCUMENT_ROOT}|g' /etc/apache2/apache2.conf

# Añadir configuración para que Apache lea las variables de entorno
RUN echo 'PassEnv APACHE_DOCUMENT_ROOT' >> /etc/apache2/conf-available/environment.conf \
    && a2enconf environment

# Configuración PHP para archivos grandes de MS Project
RUN echo "upload_max_filesize = 64M" > /usr/local/etc/php/conf.d/uploads.ini \
    && echo "post_max_size = 64M" >> /usr/local/etc/php/conf.d/uploads.ini \
    && echo "memory_limit = 256M" >> /usr/local/etc/php/conf.d/uploads.ini \
    && echo "max_execution_time = 120" >> /usr/local/etc/php/conf.d/uploads.ini

# Permisos para uploads
RUN chown -R www-data:www-data /var/www/html

