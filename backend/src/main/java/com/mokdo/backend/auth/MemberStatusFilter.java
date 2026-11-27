package com.mokdo.backend.auth;

import java.io.IOException;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.filter.OncePerRequestFilter;

public class MemberStatusFilter extends OncePerRequestFilter {
    private final GoogleMemberService members;

    public MemberStatusFilter(GoogleMemberService members) { this.members = members; }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        var authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication != null && authentication.isAuthenticated()
                && authentication.getPrincipal() instanceof MemberOidcUser member && !members.isActive(member.getMemberId())) {
            if (request.getSession(false) != null) request.getSession(false).invalidate();
            SecurityContextHolder.clearContext();
            response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
            response.setContentType("application/json");
            response.setCharacterEncoding("UTF-8");
            response.setHeader("Cache-Control", "no-store");
            response.getWriter().write("{\"code\":\"account_disabled\",\"message\":\"이용이 정지된 계정입니다.\"}");
            return;
        }
        chain.doFilter(request, response);
    }
}
