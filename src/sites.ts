// this file has the websites we track
// the sync code copies it into the sites table.
//
// Never delete an entry that has been synced.
//
// Last checked: 2026-10-30

// Must match the CHECK on sites.sector in migrations/0001_initial.sql.
export type Sector = 'news' | 'broadcast' | 'sports' | 'tech_lifestyle' | 'university' | 'government';

export interface Site {
	domain: string; // hostname, no https:// and no path
	name: string; // display name
	sector: Sector;
}

export const SITES: Site[] = [
	// National news & print
	{ domain: 'www.publico.pt', name: 'Público', sector: 'news' },
	{ domain: 'expresso.pt', name: 'Expresso', sector: 'news' },
	{ domain: 'observador.pt', name: 'Observador', sector: 'news' },
	{ domain: 'www.cmjornal.pt', name: 'Correio da Manhã', sector: 'news' },
	{ domain: 'www.jn.pt', name: 'Jornal de Notícias', sector: 'news' },
	{ domain: 'www.dn.pt', name: 'Diário de Notícias', sector: 'news' },
	{ domain: 'eco.sapo.pt', name: 'ECO', sector: 'news' },
	{
		domain: 'www.jornaldenegocios.pt',
		name: 'Jornal de Negócios',
		sector: 'news',
	},
	{ domain: 'www.sabado.pt', name: 'Sábado', sector: 'news' },
	{ domain: 'visao.pt', name: 'Visão', sector: 'news' },
	{
		domain: 'www.noticiasaominuto.com',
		name: 'Notícias ao Minuto',
		sector: 'news',
	},
	{
		domain: 'jornaleconomico.sapo.pt',
		name: 'Jornal Económico',
		sector: 'news',
	},
	{ domain: 'sol.iol.pt', name: 'SOL', sector: 'news' },
	{ domain: 'setemargens.com', name: '7Margens', sector: 'news' },
	{ domain: 'amensagem.pt', name: 'Mensagem de Lisboa', sector: 'news' },

	// Broadcasters & radio
	{ domain: 'www.rtp.pt', name: 'RTP', sector: 'broadcast' },
	{ domain: 'sicnoticias.pt', name: 'SIC Notícias', sector: 'broadcast' },
	{ domain: 'sic.pt', name: 'SIC', sector: 'broadcast' },
	{ domain: 'tvi.iol.pt', name: 'TVI', sector: 'broadcast' },
	{ domain: 'cnnportugal.iol.pt', name: 'CNN Portugal', sector: 'broadcast' },
	{ domain: 'www.tsf.pt', name: 'TSF', sector: 'broadcast' },
	{ domain: 'rr.pt', name: 'Renascença', sector: 'broadcast' },
	{ domain: 'radiocomercial.pt', name: 'Rádio Comercial', sector: 'broadcast' },
	{ domain: 'm80.pt', name: 'M80', sector: 'broadcast' },
	{ domain: 'canal11.pt', name: 'Canal 11', sector: 'broadcast' },
	{ domain: 'portocanal.fcporto.pt', name: 'Porto Canal', sector: 'broadcast' },

	// Sports
	{ domain: 'www.abola.pt', name: 'A Bola', sector: 'sports' },
	{ domain: 'www.record.pt', name: 'Record', sector: 'sports' },
	{ domain: 'www.ojogo.pt', name: 'O Jogo', sector: 'sports' },
	{ domain: 'www.zerozero.pt', name: 'zerozero', sector: 'sports' },
	{ domain: 'maisfutebol.iol.pt', name: 'Maisfutebol', sector: 'sports' },
	{ domain: 'bolanarede.pt', name: 'Bola na Rede', sector: 'sports' },
	// Clubs and governing bodies (official sites, not media)
	{ domain: 'www.slbenfica.pt', name: 'SL Benfica', sector: 'sports' },
	{ domain: 'www.fcporto.pt', name: 'FC Porto', sector: 'sports' },
	{ domain: 'scbraga.pt', name: 'SC Braga', sector: 'sports' },
	{
		domain: 'fpf.pt',
		name: 'Federação Portuguesa de Futebol',
		sector: 'sports',
	},
	{ domain: 'www.ligaportugal.pt', name: 'Liga Portugal', sector: 'sports' },

	// Tech, portals & lifestyle
	{ domain: 'sapo.pt', name: 'SAPO', sector: 'tech_lifestyle' },
	{ domain: 'pplware.sapo.pt', name: 'Pplware', sector: 'tech_lifestyle' },
	{ domain: 'www.nit.pt', name: 'NiT', sector: 'tech_lifestyle' },
	{
		domain: 'www.timeout.pt',
		name: 'Time Out Portugal',
		sector: 'tech_lifestyle',
	},
	{ domain: '4gnews.pt', name: '4gnews', sector: 'tech_lifestyle' },
	{ domain: 'shifter.pt', name: 'Shifter', sector: 'tech_lifestyle' },
	{
		domain: 'www.e-konomista.pt',
		name: 'E-Konomista',
		sector: 'tech_lifestyle',
	},
	{ domain: 'tek.sapo.pt', name: 'SAPO Tek', sector: 'tech_lifestyle' },
	{ domain: 'www.leak.pt', name: 'Leak', sector: 'tech_lifestyle' },
	{ domain: 'magg.sapo.pt', name: 'MAGG', sector: 'tech_lifestyle' },

	// Universities
	{
		domain: 'www.ulisboa.pt',
		name: 'Universidade de Lisboa',
		sector: 'university',
	},
	{
		domain: 'tecnico.ulisboa.pt',
		name: 'Instituto Superior Técnico',
		sector: 'university',
	},
	{ domain: 'www.up.pt', name: 'Universidade do Porto', sector: 'university' },
	{
		domain: 'www.uc.pt',
		name: 'Universidade de Coimbra',
		sector: 'university',
	},
	{
		domain: 'www.uminho.pt',
		name: 'Universidade do Minho',
		sector: 'university',
	},
	{
		domain: 'www.unl.pt',
		name: 'Universidade NOVA de Lisboa',
		sector: 'university',
	},
	{ domain: 'www.ua.pt', name: 'Universidade de Aveiro', sector: 'university' },
	{ domain: 'iscte-iul.pt', name: 'Iscte', sector: 'university' },
	{ domain: 'www.ucp.pt', name: 'Universidade Católica', sector: 'university' },
	{
		domain: 'www.ubi.pt',
		name: 'Universidade da Beira Interior',
		sector: 'university',
	},
	{ domain: 'www.utad.pt', name: 'UTAD', sector: 'university' },
	{
		domain: 'www.uevora.pt',
		name: 'Universidade de Évora',
		sector: 'university',
	},

	// Government & public institutions
	{ domain: 'www.gov.pt', name: 'gov.pt', sector: 'government' },
	{
		domain: 'portugal.gov.pt',
		name: 'Governo de Portugal',
		sector: 'government',
	},
	{
		domain: 'www.portaldasfinancas.gov.pt',
		name: 'Portal das Finanças',
		sector: 'government',
	},
	{ domain: 'www.sns.gov.pt', name: 'SNS', sector: 'government' },
	{
		domain: 'www.seg-social.pt',
		name: 'Segurança Social',
		sector: 'government',
	},
	{
		domain: 'diariodarepublica.pt',
		name: 'Diário da República',
		sector: 'government',
	},
	{ domain: 'www.ine.pt', name: 'INE', sector: 'government' },
	{
		domain: 'www.bportugal.pt',
		name: 'Banco de Portugal',
		sector: 'government',
	},
	{ domain: 'www.parlamento.pt', name: 'Parlamento', sector: 'government' },
	{ domain: 'dados.gov.pt', name: 'dados.gov.pt', sector: 'government' },
];
