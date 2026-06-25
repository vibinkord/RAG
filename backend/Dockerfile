FROM eclipse-temurin:21-jdk-alpine AS builder

WORKDIR /app

# Copy maven executable and configuration
COPY .mvn/ .mvn/
COPY mvnw pom.xml ./

# Add execution permissions to maven wrapper
RUN chmod +x mvnw

# Resolve dependencies
RUN ./mvnw dependency:go-offline

# Copy source code and build
COPY src ./src
RUN ./mvnw clean package -DskipTests

# Run stage
FROM eclipse-temurin:21-jre-alpine

WORKDIR /app

# Copy built artifact from builder stage
COPY --from=builder /app/target/*.jar app.jar

EXPOSE 8080

ENTRYPOINT ["java", "-jar", "app.jar"]
