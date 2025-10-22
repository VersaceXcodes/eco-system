import React from 'react';
import { Link } from 'react-router-dom';
import { useAppStore } from '@/store/main';

const GV_FOOTER: React.FC = () => {
  // CRITICAL: Individual selectors only (prevents infinite loops)
  const currentLanguage = useAppStore(state => state.config.language);
  const wcagComplianceLevel = useAppStore(state => state.config.wcag_compliance_level);
  
  // Organization information
  const organization = {
    name: "EcoPulse",
    mission: "Democratize environmental data collection through user-generated observations while providing actionable insights for ecological preservation.",
    email: "contact@ecopulse.org",
    address: "Conservation Tech Foundation, 123 Green Way, San Francisco, CA 94107"
  };
  
  // Social media links
  const socialLinks = [
    { name: "Twitter", url: "https://twitter.com/ecopulse", icon: "twitter" },
    { name: "Facebook", url: "https://facebook.com/ecopulse", icon: "facebook" },
    { name: "Instagram", url: "https://instagram.com/ecopulse", icon: "instagram" },
    { name: "GitHub", url: "https://github.com/ecopulse", icon: "github" }
  ];
  
  // Legal links (using same route for Terms/Privacy in MVP)
  const legalLinks = [
    { name: "Terms of Service", to: "/terms-privacy" },
    { name: "Privacy Policy", to: "/terms-privacy" },
    { name: "Copyright Notice", to: "/terms-privacy" }
  ];
  
  // Resource links
  const resourceLinks = [
    { name: "Help Center", to: "/help-center" },
    { name: "Species Identification Guides", to: "/guides" },
    { name: "API Documentation", to: "/api-docs" },
    { name: "Contact Support", to: "/contact" }
  ];

  return (
    <>
      <footer className="bg-white border-t border-gray-200 mt-auto">
        <div className="max-w-7xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {/* Organization Info Column */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-900">{organization.name}</h3>
              <p className="text-gray-600 text-sm leading-relaxed">
                {organization.mission}
              </p>
              <div className="space-y-2">
                <p className="text-gray-600 text-sm flex items-start">
                  <svg className="w-4 h-4 mt-1 mr-2 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path>
                  </svg>
                  <span>{organization.email}</span>
                </p>
                <p className="text-gray-600 text-sm flex items-start">
                  <svg className="w-4 h-4 mt-1 mr-2 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path>
                  </svg>
                  <span>{organization.address}</span>
                </p>
              </div>
            </div>
            
            {/* Legal Links Column */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-900">Legal</h3>
              <ul className="space-y-2">
                {legalLinks.map((link) => (
                  <li key={link.name}>
                    <Link 
                      to={link.to} 
                      className="text-gray-600 hover:text-blue-600 text-sm transition-colors duration-200 inline-flex items-center"
                    >
                      {link.name}
                      <svg className="w-3 h-3 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4m-4 1l4-4m0 0l-4-4m4 4H6"></path>
                      </svg>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
            
            {/* Resources Column */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-900">Resources</h3>
              <ul className="space-y-2">
                {resourceLinks.map((link) => (
                  <li key={link.name}>
                    <Link 
                      to={link.to} 
                      className="text-gray-600 hover:text-blue-600 text-sm transition-colors duration-200 inline-flex items-center"
                    >
                      {link.name}
                      <svg className="w-3 h-3 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4m-4 1l4-4m0 0l-4-4m4 4H6"></path>
                      </svg>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
            
            {/* Social Links & Accessibility Column */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-900">Connect With Us</h3>
              
              {/* Social Media Links */}
              <div className="flex space-x-4">
                {socialLinks.map((social) => (
                  <a 
                    key={social.name}
                    href={social.url} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-gray-400 hover:text-gray-600 transition-colors duration-200"
                    aria-label={`Visit our ${social.name} page`}
                  >
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path d={
                        social.icon === 'twitter' ? 
                          "M8.29 20.251c7.547 0 11.675-6.253 11.675-11.675 0-.178 0-.355-.012-.53A8.348 8.348 0 0022 5.92a8.19 8.19 0 01-2.357.646 4.118 4.118 0 001.804-2.27 8.224 8.224 0 01-2.605.996 4.107 4.107 0 00-6.993 3.743 11.65 11.65 0 01-8.457-4.287 4.106 4.106 0 001.27 5.477A4.072 4.072 0 012.8 9.713v.052a4.105 4.105 0 003.292 4.022 4.095 4.095 0 01-1.853.07 4.108 4.108 0 003.834 2.85A8.233 8.233 0 012 18.407a11.616 11.616 0 006.29 1.84" :
                        social.icon === 'facebook' ?
                          "M22 12c0-5.523-4.477-10-10-10S2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.878v-6.987h-2.54V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.988C18.343 21.128 22 16.991 22 12z" :
                        social.icon === 'instagram' ?
                          "M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.873 0 8.472.01 7.03.06 2.693.247.248 2.694.06 7.03.01 8.472 0 8.873 0 12c0 3.127.01 3.528.06 4.97.187 4.332 2.64 6.785 6.97 6.97.144.045.454.06.916.06s.772-.015 1.226-.06c4.33-.185 6.783-2.638 6.969-6.97.05-.962.06-1.226.06-4.97 0-3.127-.01-3.528-.06-4.97-.187-4.332-2.638-6.785-6.969-6.97C12.454.01 12.149 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" :
                        social.icon === 'github' ?
                          "M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" :
                        ""
                      } />
                    </svg>
                  </a>
                ))}
              </div>
              
              {/* Accessibility Statement */}
              <div className="pt-4 border-t border-gray-200 mt-4">
                <p className="text-gray-600 text-sm mb-2">
                  Committed to digital accessibility and inclusive design
                </p>
                <div className="flex items-center">
                  <span className="text-gray-600 text-sm mr-2">WCAG Compliance:</span>
                  <span className={`px-2 py-1 rounded text-xs font-medium ${
                    wcagComplianceLevel === 'AA' 
                      ? 'bg-green-100 text-green-800' 
                      : wcagComplianceLevel === 'AAA'
                        ? 'bg-blue-100 text-blue-800'
                        : 'bg-yellow-100 text-yellow-800'
                  }`}>
                    {wcagComplianceLevel}
                  </span>
                </div>
              </div>
              
              {/* Language Selector (MVP - English only) */}
              <div className="mt-4">
                <div className="flex items-center">
                  <span className="text-gray-600 text-sm mr-2">Language:</span>
                  <div className="flex items-center bg-gray-100 rounded px-2.5 py-1">
                    <span className="text-gray-800 font-medium">English</span>
                    <span className="ml-1.5 text-xs text-gray-500">(Current)</span>
                  </div>
                </div>
              </div>
              
              {/* Trust Badges */}
              <div className="mt-4 pt-3 border-t border-gray-200">
                <div className="flex flex-wrap gap-2">
                  <div className="bg-gray-50 border border-gray-200 rounded px-2 py-1 text-xs text-gray-600 flex items-center">
                    <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 24 24">
                      <path fillRule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12zm13.36-1.814a.75.75 0 10-1.22-.872l-4.125 2.887a.75.75 0 00-.69 0L7.232 9.974a.75.75 0 10-1.22.872l4.125 2.887a.75.75 0 00.69 0l4.125-2.887z" clipRule="evenodd" />
                    </svg>
                    Verified Data Source
                  </div>
                  <div className="bg-gray-50 border border-gray-200 rounded px-2 py-1 text-xs text-gray-600 flex items-center">
                    <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 24 24">
                      <path fillRule="evenodd" d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25zm-1.72 6.97a.75.75 0 10-1.06 1.06L10.94 12l-1.72 1.72a.75.75 0 101.06 1.06L12 13.06l1.72 1.72a.75.75 0 101.06-1.06L13.06 12l1.72-1.72a.75.75 0 10-1.06-1.06L12 10.94l-1.72-1.72z" clipRule="evenodd" />
                    </svg>
                    Community Verified
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          {/* Bottom Bar with Copyright */}
          <div className="mt-12 pt-8 border-t border-gray-200 text-center text-gray-500 text-sm">
            <p className="mb-1">&copy; {new Date().getFullYear()} EcoPulse. All rights reserved.</p>
            <p className="text-gray-500 opacity-75 text-xs">
              Open source environmental monitoring platform
            </p>
          </div>
        </div>
      </footer>
    </>
  );
};

export default GV_FOOTER;