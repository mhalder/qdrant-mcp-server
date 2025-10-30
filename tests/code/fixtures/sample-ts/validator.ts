/**
 * Complex validation logic with high cyclomatic complexity
 */

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export class Validator {
  /**
   * Validates user input with multiple conditions
   */
  validateUserInput(input: any): ValidationResult {
    const errors: string[] = [];

    if (!input) {
      errors.push("Input is required");
      return { valid: false, errors };
    }

    if (typeof input.email === "string") {
      if (input.email.length < 5) {
        errors.push("Email too short");
      } else if (input.email.length > 100) {
        errors.push("Email too long");
      } else if (!input.email.includes("@")) {
        errors.push("Invalid email format");
      } else if (input.email.startsWith("@") || input.email.endsWith("@")) {
        errors.push("Email cannot start or end with @");
      }
    } else {
      errors.push("Email must be a string");
    }

    if (input.age !== undefined) {
      if (typeof input.age !== "number") {
        errors.push("Age must be a number");
      } else if (input.age < 0) {
        errors.push("Age cannot be negative");
      } else if (input.age > 150) {
        errors.push("Age seems unrealistic");
      } else if (input.age < 13) {
        errors.push("Must be 13 or older");
      }
    }

    if (input.password) {
      const pwd = input.password;
      if (pwd.length < 8) {
        errors.push("Password too short");
      } else if (pwd.length > 128) {
        errors.push("Password too long");
      }

      let hasUpper = false;
      let hasLower = false;
      let hasDigit = false;
      let hasSpecial = false;

      for (const char of pwd) {
        if (char >= "A" && char <= "Z") {
          hasUpper = true;
        } else if (char >= "a" && char <= "z") {
          hasLower = true;
        } else if (char >= "0" && char <= "9") {
          hasDigit = true;
        } else if ("!@#$%^&*()_+-=[]{}|;:,.<>?".includes(char)) {
          hasSpecial = true;
        }
      }

      if (!hasUpper) {
        errors.push("Password needs uppercase letter");
      }
      if (!hasLower) {
        errors.push("Password needs lowercase letter");
      }
      if (!hasDigit) {
        errors.push("Password needs digit");
      }
      if (!hasSpecial) {
        errors.push("Password needs special character");
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Process data with multiple switch cases and conditions
   */
  processData(data: any, type: string): any {
    switch (type) {
      case "string":
        return String(data);
      case "number":
        return Number(data);
      case "boolean":
        return Boolean(data);
      case "array":
        if (Array.isArray(data)) {
          return data;
        } else if (data === null || data === undefined) {
          return [];
        } else {
          return [data];
        }
      case "object":
        if (typeof data === "object" && data !== null) {
          return data;
        } else {
          return { value: data };
        }
      case "json":
        try {
          return JSON.parse(data);
        } catch (_e) {
          return null;
        }
      default:
        return data;
    }
  }

  /**
   * Complex nested conditions
   */
  checkPermissions(user: any, resource: string, action: string): boolean {
    if (!user) {
      return false;
    }

    if (user.role === "admin") {
      return true;
    }

    if (user.role === "moderator") {
      if (action === "read" || action === "update") {
        return true;
      } else if (action === "delete" && resource !== "user") {
        return true;
      }
    }

    if (user.role === "user") {
      if (action === "read") {
        return true;
      } else if (action === "update" && resource === "profile") {
        return user.id === resource;
      }
    }

    if (user.permissions && Array.isArray(user.permissions)) {
      for (const perm of user.permissions) {
        if (perm.resource === resource && (perm.action === action || perm.action === "*")) {
          return true;
        }
      }
    }

    return false;
  }
}

export default Validator;
