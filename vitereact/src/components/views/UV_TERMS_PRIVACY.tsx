import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAppStore } from '@/store/main';

const UV_TERMS_PRIVACY: React.FC = () => {
  // Individual Zustand selectors - critical pattern to prevent infinite loops
  const isAuthenticated = useAppStore(state => state.authentication_state.authentication_status.is_authenticated);
  const redirectTo = useAppStore(state => state.redirect_to);
  
  // Local state for acceptance checkboxes
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [acceptedPrivacy, setAcceptedPrivacy] = useState(false);
  const [bothAccepted, setBothAccepted] = useState(false);
  const [showError, setShowError] = useState(false);
  
  // Navigation hooks
  const navigate = useNavigate();
  const location = useLocation();
  
  // Determine if we're coming from signup flow
  const isFromSignup = location.state?.fromSignup || false;
  
  // Redirect if already authenticated (unless coming from signup flow)
  useEffect(() => {
    if (isAuthenticated && !isFromSignup) {
      navigate(redirectTo || '/', { replace: true });
    }
  }, [isAuthenticated, navigate, redirectTo, isFromSignup]);
  
  // Handle checkbox changes with proper error clearing
  const handleTermsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setAcceptedTerms(e.target.checked);
    setShowError(false);
    if (e.target.checked && acceptedPrivacy) {
      setBothAccepted(true);
    } else {
      setBothAccepted(false);
    }
  };
  
  const handlePrivacyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setAcceptedPrivacy(e.target.checked);
    setShowError(false);
    if (e.target.checked && acceptedTerms) {
      setBothAccepted(true);
    } else {
      setBothAccepted(false);
    }
  };
  
  // Handle form submission with validation
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!acceptedTerms || !acceptedPrivacy) {
      setShowError(true);
      return;
    }
    
    // If coming from signup, proceed to profile setup
    if (isFromSignup) {
      navigate('/profile-setup', { replace: true });
    } else {
      // Otherwise redirect to dashboard or login
      navigate(redirectTo || '/login', { replace: true });
    }
  };
  
  // Mock document versions - would come from API in real implementation
  const termsVersion = "2.1";
  const termsEffectiveDate = "January 15, 2024";
  const privacyVersion = "2.0";
  const privacyEffectiveDate = "December 1, 2023";
  
  // Mock document content - would come from API in real implementation
  const termsSections = [
    {
      id: "account",
      title: "Account Registration and Security",
      summary: "You are responsible for maintaining the confidentiality of your account credentials.",
      content: `By creating an account with EcoPulse, you agree to provide accurate and current information. You are solely responsible for maintaining the confidentiality of your account credentials and for all activities that occur under your account. You agree to notify EcoPulse immediately of any unauthorized use of your account or any other breach of security. EcoPulse cannot and will not be liable for any loss or damage arising from your failure to comply with this security obligation.`,
      plainLanguage: "This means you need to keep your password safe and tell us immediately if someone else might be using your account. We're not responsible if you share your password or don't report security issues."
    },
    {
      id: "content",
      title: "User Content and Responsibilities",
      summary: "You retain ownership of content you submit but grant EcoPulse a license to use it.",
      content: `You retain all ownership rights to any content you submit, post, or display on or through the EcoPulse platform. By submitting content, you grant EcoPulse a worldwide, non-exclusive, royalty-free, sublicensable, and transferable license to use, reproduce, distribute, prepare derivative works of, display, and perform the content solely for the purposes of providing and improving the EcoPulse services. You represent and warrant that you have all rights necessary to grant this license.`,
      plainLanguage: "You still own your photos and observations, but you give us permission to use them to run our service. This helps us share biodiversity data with researchers and conservationists."
    },
    {
      id: "data",
      title: "Data Collection and Usage",
      summary: "We collect data to provide and improve our services.",
      content: `EcoPulse collects personal information that you provide directly to us, including when you create an account, submit observations, or communicate with us. We also collect information automatically when you use our services, including device information, usage data, and location data. We use this information to provide, maintain, and improve our services, to develop new features, and to communicate with you. We do not sell your personal information to third parties.`,
      plainLanguage: "We collect information you give us plus some automatic data to make our service work better. We never sell your personal information."
    }
  ];
  
  const privacySections = [
    {
      id: "information-collection",
      title: "Information We Collect",
      summary: "We collect information you provide and information collected automatically.",
      content: `We collect information that you provide directly to us when you use EcoPulse, including your email address, name, location data, and observation content. We also collect information automatically when you use our services, including device information, usage patterns, and precise location data when permitted. Additionally, we may collect information from third parties, such as Google SSO providers, with your consent.`,
      plainLanguage: "We collect what you tell us plus some automatic data to improve your experience. Location data helps us show relevant ecological information."
    },
    {
      id: "information-use",
      title: "How We Use Information",
      summary: "We use information to provide services, improve functionality, and communicate.",
      content: `We use the information we collect to provide, maintain, and improve EcoPulse services; to personalize your experience; to process your observations and submissions; to communicate with you about your account and updates; to develop new features; and to comply with legal obligations. We may use aggregated or anonymized data for research and analytics purposes.`,
      plainLanguage: "Your data helps us run the service, make it better, and keep you informed. Anonymized data helps scientists study biodiversity trends."
    },
    {
      id: "data-sharing",
      title: "Data Sharing and Disclosure",
      summary: "We share data only with your consent or as necessary for service operation.",
      content: `We share your information only in the following circumstances: with your consent; with service providers who assist in operating our services; to comply with legal requirements; to protect our rights and safety; and in connection with business transfers. For municipal planners and researchers, we may provide aggregated, anonymized datasets for ecological research. Private observations are never shared without explicit user consent.`,
      plainLanguage: "We only share your data when you say it's okay, when necessary to run the service, or when required by law. Your private observations stay private unless you choose to share them."
    },
    {
      id: "data-security",
      title: "Data Security",
      summary: "We implement security measures to protect your information.",
      content: `EcoPulse implements industry-standard security measures to protect your personal information against unauthorized access, alteration, disclosure, or destruction. These measures include encryption, access controls, and regular security assessments. However, no electronic transmission over the internet or storage technology is 100% secure. While we strive to use commercially acceptable means to protect your information, we cannot guarantee its absolute security.`,
      plainLanguage: "We use strong security practices, but no online service can be completely secure. Please be careful with your account information."
    }
  ];
  
  return (
    <>
      <div className="min-h-screen bg-gray-50 flex flex-col">
        {/* Header */}
        <header className="bg-white shadow-sm">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
            <Link to="/" className="flex items-center">
              <div className="bg-blue-600 rounded-lg p-2 mr-3">
                <svg className="h-8 w-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                </svg>
              </div>
              <h1 className="text-2xl font-bold text-gray-900">EcoPulse</h1>
            </Link>
            
            <div className="flex items-center space-x-4">
              <Link 
                to={isFromSignup ? "/signup" : "/login"} 
                className="text-gray-600 hover:text-gray-900 font-medium transition-colors"
              >
                {isFromSignup ? "Back to Sign Up" : "Sign In"}
              </Link>
            </div>
          </div>
        </header>

        <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="lg:grid lg:grid-cols-12 lg:gap-8">
            {/* Document Navigation Sidebar */}
            <div className="lg:col-span-3">
              <div className="sticky top-8">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Document Navigation</h2>
                
                <div className="space-y-1">
                  <button 
                    onClick={() => document.getElementById('terms-summary')?.scrollIntoView({ behavior: 'smooth' })}
                    className="w-full text-left px-3 py-2 rounded-md text-base font-medium text-blue-600 hover:bg-blue-50 hover:text-blue-800 transition-colors"
                  >
                    Terms of Service Summary
                  </button>
                  
                  {termsSections.map((section) => (
                    <button
                      key={`terms-${section.id}`}
                      onClick={() => document.getElementById(`terms-${section.id}`)?.scrollIntoView({ behavior: 'smooth' })}
                      className="w-full text-left pl-6 pr-3 py-1.5 rounded-md text-sm text-gray-700 hover:bg-gray-100 hover:text-gray-900 transition-colors"
                    >
                      {section.title}
                    </button>
                  ))}
                  
                  <button 
                    onClick={() => document.getElementById('privacy-summary')?.scrollIntoView({ behavior: 'smooth' })}
                    className="w-full text-left px-3 py-2 rounded-md text-base font-medium text-blue-600 hover:bg-blue-50 hover:text-blue-800 transition-colors mt-3"
                  >
                    Privacy Policy Summary
                  </button>
                  
                  {privacySections.map((section) => (
                    <button
                      key={`privacy-${section.id}`}
                      onClick={() => document.getElementById(`privacy-${section.id}`)?.scrollIntoView({ behavior: 'smooth' })}
                      className="w-full text-left pl-6 pr-3 py-1.5 rounded-md text-sm text-gray-700 hover:bg-gray-100 hover:text-gray-900 transition-colors"
                    >
                      {section.title}
                    </button>
                  ))}
                  
                  <button 
                    onClick={() => document.getElementById('acceptance-section')?.scrollIntoView({ behavior: 'smooth' })}
                    className="w-full text-left px-3 py-2 rounded-md text-base font-medium text-green-600 hover:bg-green-50 hover:text-green-800 transition-colors mt-3"
                  >
                    Acceptance & Next Steps
                  </button>
                </div>
                
                <div className="mt-6 pt-6 border-t border-gray-200">
                  <h3 className="text-sm font-medium text-gray-900 mb-2">Document Versions</h3>
                  <div className="space-y-2">
                    <div>
                      <p className="text-xs text-gray-500">Terms of Service</p>
                      <p className="text-sm font-medium text-gray-900">Version {termsVersion} • Effective {termsEffectiveDate}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Privacy Policy</p>
                      <p className="text-sm font-medium text-gray-900">Version {privacyVersion} • Effective {privacyEffectiveDate}</p>
                    </div>
                  </div>
                  
                  <button 
                    className="mt-3 w-full inline-flex items-center justify-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 rounded-md transition-colors"
                  >
                    <svg className="-ml-1 mr-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                    Download PDF (Terms)
                  </button>
                  <button 
                    className="mt-2 w-full inline-flex items-center justify-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 rounded-md transition-colors"
                  >
                    <svg className="-ml-1 mr-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                    Download PDF (Privacy)
                  </button>
                </div>
              </div>
            </div>
            
            {/* Document Content */}
            <div className="lg:col-span-9">
              <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
                {/* Terms of Service Section */}
                <div id="terms-summary" className="border-b border-gray-200 px-6 py-8">
                  <h2 className="text-2xl font-bold text-gray-900 mb-2">Terms of Service</h2>
                  <p className="text-gray-600 mb-4">Effective Date: {termsEffectiveDate} • Version: {termsVersion}</p>
                  
                  <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded-r-md mb-6">
                    <h3 className="font-semibold text-blue-800 flex items-center">
                      <svg className="h-5 w-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zm1 3a1 1 0 00-1 1v1a1 1 0 102 0v-1a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                      Key Points Summary
                    </h3>
                    <ul className="mt-2 list-disc pl-5 space-y-1 text-blue-700">
                      <li>You retain ownership of your observation content</li>
                      <li>You grant EcoPulse a license to use your content for service provision</li>
                      <li>You're responsible for account security</li>
                      <li>We may update these terms with notice</li>
                    </ul>
                  </div>
                  
                  {termsSections.map((section) => (
                    <div key={`terms-content-${section.id}`} className="mb-8">
                      <div id={`terms-${section.id}`} className="scroll-mt-16">
                        <h3 className="text-xl font-semibold text-gray-900 mb-3">{section.title}</h3>
                        
                        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-4">
                          <h4 className="font-medium text-gray-700 flex items-center mb-2">
                            <svg className="h-4 w-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            Plain Language Explanation
                          </h4>
                          <p className="text-gray-600">{section.plainLanguage}</p>
                        </div>
                        
                        <div className="border-l-4 border-gray-300 pl-4 py-2">
                          <h4 className="font-medium text-gray-900 mb-2">Legal Text</h4>
                          <p className="text-gray-700">{section.content}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                
                {/* Privacy Policy Section */}
                <div id="privacy-summary" className="border-b border-gray-200 px-6 py-8">
                  <h2 className="text-2xl font-bold text-gray-900 mb-2">Privacy Policy</h2>
                  <p className="text-gray-600 mb-4">Effective Date: {privacyEffectiveDate} • Version: {privacyVersion}</p>
                  
                  <div className="bg-green-50 border-l-4 border-green-500 p-4 rounded-r-md mb-6">
                    <h3 className="font-semibold text-green-800 flex items-center">
                      <svg className="h-5 w-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zm1 3a1 1 0 00-1 1v1a1 1 0 102 0v-1a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                      Your Key Rights
                    </h3>
                    <ul className="mt-2 list-disc pl-5 space-y-1 text-green-700">
                      <li>You control what data is shared publicly vs. kept private</li>
                      <li>You can download your data at any time</li>
                      <li>You can request deletion of your account</li>
                      <li>We never sell your personal information</li>
                    </ul>
                  </div>
                  
                  {privacySections.map((section) => (
                    <div key={`privacy-content-${section.id}`} className="mb-8">
                      <div id={`privacy-${section.id}`} className="scroll-mt-16">
                        <h3 className="text-xl font-semibold text-gray-900 mb-3">{section.title}</h3>
                        
                        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-4">
                          <h4 className="font-medium text-gray-700 flex items-center mb-2">
                            <svg className="h-4 w-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            Plain Language Explanation
                          </h4>
                          <p className="text-gray-600">{section.plainLanguage}</p>
                        </div>
                        
                        <div className="border-l-4 border-gray-300 pl-4 py-2">
                          <h4 className="font-medium text-gray-900 mb-2">Policy Text</h4>
                          <p className="text-gray-700">{section.content}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                
                {/* Acceptance Section */}
                <div id="acceptance-section" className="px-6 py-8 bg-gradient-to-br from-blue-50 to-indigo-50">
                  <div className="max-w-3xl mx-auto">
                    <h2 className="text-2xl font-bold text-center text-gray-900 mb-2">Acceptance Required</h2>
                    <p className="text-center text-gray-600 mb-6">
                      To continue using EcoPulse, you must accept both the Terms of Service and Privacy Policy
                    </p>
                    
                    {showError && (
                      <div className="mb-6 bg-red-50 border border-red-200 rounded-md p-4" role="alert" aria-live="polite">
                        <div className="flex">
                          <div className="flex-shrink-0">
                            <svg className="h-5 w-5 text-red-400" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                            </svg>
                          </div>
                          <div className="ml-3 flex-1 pt-0.5">
                            <p className="text-sm font-medium text-red-800">
                              Please accept both documents to continue
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                    
                    <form onSubmit={handleSubmit} className="space-y-4">
                      <div className="flex items-start p-4 bg-white border border-gray-200 rounded-lg">
                        <div className="flex items-center h-5">
                          <input
                            id="terms-accept"
                            type="checkbox"
                            checked={acceptedTerms}
                            onChange={handleTermsChange}
                            className="focus:ring-blue-500 h-4 w-4 text-blue-600 border-gray-300 rounded"
                          />
                        </div>
                        <div className="ml-3 text-sm">
                          <label htmlFor="terms-accept" className="font-medium text-gray-700">
                            I accept the Terms of Service
                          </label>
                          <p className="text-gray-500">
                            I have read and agree to the Terms of Service, including the license grant for my observation data.
                          </p>
                        </div>
                      </div>
                      
                      <div className="flex items-start p-4 bg-white border border-gray-200 rounded-lg">
                        <div className="flex items-center h-5">
                          <input
                            id="privacy-accept"
                            type="checkbox"
                            checked={acceptedPrivacy}
                            onChange={handlePrivacyChange}
                            className="focus:ring-blue-500 h-4 w-4 text-blue-600 border-gray-300 rounded"
                          />
                        </div>
                        <div className="ml-3 text-sm">
                          <label htmlFor="privacy-accept" className="font-medium text-gray-700">
                            I accept the Privacy Policy
                          </label>
                          <p className="text-gray-500">
                            I have read and agree to the Privacy Policy regarding collection and use of my personal information.
                          </p>
                        </div>
                      </div>
                      
                      <button
                        type="submit"
                        disabled={!bothAccepted}
                        className={`w-full py-3 px-4 rounded-lg font-medium text-white shadow-lg transition-all duration-200 ${
                          bothAccepted 
                            ? 'bg-blue-600 hover:bg-blue-700 hover:shadow-xl' 
                            : 'bg-gray-400 cursor-not-allowed'
                        }`}
                      >
                        {isFromSignup ? 'Continue to Profile Setup' : 'Accept and Continue'}
                      </button>
                      
                      <p className="text-center text-sm text-gray-500 mt-4">
                        By accepting, you acknowledge that EcoPulse may update these documents with notice, and material changes may require re-acceptance.
                      </p>
                    </form>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </main>
        
        {/* Footer */}
        <footer className="bg-gray-50 border-t border-gray-200 mt-12">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <div className="text-center text-gray-500 text-sm">
              <p>EcoPulse &copy; {new Date().getFullYear()} - Open Source Environmental Monitoring Platform</p>
              <p className="mt-2">
                <Link to="/terms-privacy" className="text-gray-600 hover:text-gray-900">
                  Terms of Service & Privacy Policy
                </Link>
                {' • '}
                <Link to="/help-center" className="text-gray-600 hover:text-gray-900">
                  Help Center
                </Link>
                {' • '}
                <Link to="/contact" className="text-gray-600 hover:text-gray-900">
                  Contact Us
                </Link>
              </p>
            </div>
          </div>
        </footer>
      </div>
    </>
  );
};

export default UV_TERMS_PRIVACY;