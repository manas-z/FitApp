declare module 'react-native-gesture-handler' {
  import * as React from 'react';
  import { ViewProps } from 'react-native';

  export class GestureHandlerRootView extends React.Component<ViewProps> {}
}

declare module 'react-native-draggable-flatlist' {
  import * as React from 'react';
  import { FlatListProps } from 'react-native';

  export type RenderItemParams<TItem> = {
    item: TItem;
    index: number;
    drag: () => void;
    isActive: boolean;
    getIndex?: () => number;
  };

  export interface DragEndParams<TItem> {
    data: TItem[];
    from: number;
    to: number;
  }

  export interface DraggableFlatListProps<TItem>
    extends Omit<FlatListProps<TItem>, 'renderItem' | 'onDragEnd'> {
    renderItem: (info: RenderItemParams<TItem>) => React.ReactElement | null;
    onDragEnd: (params: DragEndParams<TItem>) => void;
  }

  export default class DraggableFlatList<TItem> extends React.Component<DraggableFlatListProps<TItem>> {}
}
