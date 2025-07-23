import { RouteNamesEnum } from 'localConstants';
import { Dashboard, Disclaimer, Home, Unlock, Tournaments, TournamentDetails, CreateTournament } from 'pages';
import { RouteType } from 'types';

interface RouteWithTitleType extends RouteType {
  title: string;
  authenticatedRoute?: boolean;
  children?: RouteWithTitleType[];
}

export const routes: RouteWithTitleType[] = [
  {
    path: RouteNamesEnum.home,
    title: 'Home',
    component: Home,
    children: [
      {
        path: RouteNamesEnum.unlock,
        title: 'Unlock',
        component: Unlock
      }
    ]
  },
  {
    path: '/tournaments',
    title: 'Tournaments',
    component: Tournaments
  },
  {
    path: '/tournaments/:id',
    title: 'Tournament Details',
    component: TournamentDetails
  },
  {
    path: '/tournaments/create',
    title: 'Create Tournament',
    component: CreateTournament
  },
  {
    path: RouteNamesEnum.disclaimer,
    title: 'Disclaimer',
    component: Disclaimer
  }
];
