import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './login.html',
  styleUrls: ['./login.css']
})
export class Login {
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private router = inject(Router);

  isSubmitting = signal(false);
  loginError = signal<string | null>(null);
  isRedirecting = signal(false);
  isAnimating = signal(false);
  isRegisterMode = signal(false);
  signupSuccess = signal<string | null>(null);

  loginForm = this.fb.group({
    username: ['', [Validators.required, Validators.minLength(3)]],
    password: ['', [Validators.required, Validators.minLength(6)]]
  });

  signupForm = this.fb.group({
    fullname: ['', [Validators.required, Validators.minLength(2)]],
    username: ['', [Validators.required, Validators.minLength(3)]],
    email: ['', [Validators.required, Validators.email]],
    phone_number: ['', [Validators.required, Validators.minLength(7)]],
    city: ['', [Validators.required, Validators.minLength(2)]],
    password: ['', [Validators.required, Validators.minLength(6)]]
  });

  toggleRegisterMode(): void {
    this.isRegisterMode.set(!this.isRegisterMode());
    this.loginError.set(null);
    this.signupSuccess.set(null);
    this.signupForm.reset();
    this.loginForm.reset();
  }

  onSubmit(): void {
    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      return;
    }

    const { username, password } = this.loginForm.value;
    this.isSubmitting.set(true);
    this.loginError.set(null);

    this.authService.login(username!, password!).subscribe({
      next: () => {
        this.authService.loadCurrentUser().subscribe({
          next: (user) => {
            this.isAnimating.set(true);

            setTimeout(() => {
              if (user.role === 'Dispatcher') {
                const token = this.authService.getToken();
                this.authService.clearSessionSilently();
                this.isRedirecting.set(true);
                window.location.href = `${environment.dispatcherAppUrl}/auth-bridge?token=${encodeURIComponent(token!)}`;
                return;
              }

              if (user.role === 'Agent') {
                const token = this.authService.getToken();
                this.authService.clearSessionSilently();
                this.isRedirecting.set(true);
                window.location.href = `${environment.agentAppUrl}/auth-bridge?token=${encodeURIComponent(token!)}`;
                return;
              }

              if (user.role === 'Customer') {
                const token = this.authService.getToken();
                this.authService.clearSessionSilently();
                this.isRedirecting.set(true);
                window.location.href = `${environment.customerAppUrl}/auth-bridge?token=${encodeURIComponent(token!)}`;
                return;
              }

              this.isSubmitting.set(false);

              if (user.role !== 'Admin') {
                this.isAnimating.set(false);
                this.authService.clearSessionSilently();
                this.loginError.set('This portal is restricted to Admin accounts.');
                return;
              }
              this.router.navigate(['/dashboard']);
            }, 3000);
          },
          error: () => {
            this.isSubmitting.set(false);
            this.loginError.set('Failed to load user profile.');
          }
        });
      },
      error: (err) => {
        this.isSubmitting.set(false);
        this.loginError.set(err?.error?.detail || 'Invalid username or password.');
      }
    });
  }

  onRegisterSubmit(): void {
    if (this.signupForm.invalid) {
      this.signupForm.markAllAsTouched();
      return;
    }

    this.isSubmitting.set(true);
    this.loginError.set(null);
    this.signupSuccess.set(null);

    const payload = this.signupForm.value;
    this.authService.signup(payload).subscribe({
      next: (res) => {
        this.isSubmitting.set(false);
        this.signupSuccess.set('Account created successfully! Please sign in using your credentials.');
        this.isRegisterMode.set(false);
        this.signupForm.reset();
      },
      error: (err) => {
        this.isSubmitting.set(false);
        this.loginError.set(err?.error?.detail || 'Failed to create account. Please check inputs.');
      }
    });
  }

  get f() {
    return this.loginForm.controls;
  }

  get sf() {
    return this.signupForm.controls;
  }
}

